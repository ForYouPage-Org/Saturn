import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { getCurrentParticipant } from "@/lib/auth-server";
import { q } from "@/lib/db";
import { getAzureModel, azureReady, modelName } from "@/lib/azure";
import { logCall } from "@/lib/azure-usage";

export const runtime = "nodejs";
// SSE streams can run long — match _hub's ceiling.
export const maxDuration = 300;

const HISTORY_WINDOW = Number(process.env.MERCURY_HISTORY_WINDOW ?? 20);
const SYSTEM_PROMPT =
  process.env.MERCURY_SYSTEM_PROMPT ??
  "You are a helpful, friendly assistant for a teenage user participating in a research study. " +
    "Be warm, concise, and age-appropriate. Do not ask for or store any personally identifying information. " +
    "If the user expresses serious distress or mentions self-harm, gently suggest reaching out to a trusted adult or a crisis resource.";

function extractText(msg: UIMessage): string {
  const parts = (msg.parts ?? []) as Array<{ type: string; text?: string }>;
  return parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n")
    .trim();
}

export async function POST(req: Request) {
  const me = await getCurrentParticipant();
  if (!me) return new Response("unauthorized", { status: 401 });

  if (!azureReady()) {
    return new Response(
      "Azure OpenAI not configured — set AZURE_OPENAI_API_KEY and AZURE_OPENAI_BASE_URL",
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    messages?: UIMessage[];
  } | null;
  const incoming = body?.messages ?? [];
  const lastUser = [...incoming].reverse().find((m) => m.role === "user");
  const lastUserText = lastUser ? extractText(lastUser) : "";
  if (!lastUserText) return new Response("empty message", { status: 400 });
  if (lastUserText.length > 8000) return new Response("too long", { status: 400 });

  // Persist the user turn immediately — even if generation fails we still
  // have the prompt on disk.
  q.insertMessage.run({
    participant_id: me.id,
    role: "user",
    content: lastUserText,
  });

  // Build server-side history for LLM context.
  const recent = q.recentMessages.all(me.id, HISTORY_WINDOW * 2);
  const history: UIMessage[] = recent
    .reverse()
    .map((m, i) => ({
      id: `h${i}`,
      role: (m.role === "system" ? "system" : m.role) as "system" | "user" | "assistant",
      parts: [{ type: "text", text: m.content }],
    }));

  const t0 = Date.now();
  const participantCode = me.participant_code;

  const modelMessages = await convertToModelMessages(history);
  const result = streamText({
    model: getAzureModel(),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    onFinish: ({ text, totalUsage, finishReason }) => {
      const durationMs = Date.now() - t0;
      try {
        q.insertMessage.run({
          participant_id: me.id,
          role: "assistant",
          content: text,
        });
      } catch (err) {
        console.error(
          `[chat] failed to persist assistant turn: ${(err as Error).message}`
        );
      }
      logCall({
        participantCode,
        model: modelName(),
        prompt: lastUserText,
        inputTokens: totalUsage?.inputTokens ?? 0,
        outputTokens: totalUsage?.outputTokens ?? 0,
        reasoningTokens: 0,
        durationMs,
        ...(finishReason === "error" ? { error: "stream ended with error" } : {}),
      });
    },
    onError: ({ error }) => {
      const durationMs = Date.now() - t0;
      logCall({
        participantCode,
        model: modelName(),
        prompt: lastUserText,
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        durationMs,
        error: (error as Error)?.message ?? String(error),
      });
    },
  });

  return result.toUIMessageStreamResponse();
}
