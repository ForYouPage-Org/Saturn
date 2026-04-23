// Chat edge function: receives a user message, calls Azure OpenAI (Responses
// API), persists both turns, returns the assistant message.
//
// Deploy with:
//   supabase functions deploy chat --no-verify-jwt=false
//   supabase secrets set AZURE_OPENAI_API_KEY=... AZURE_OPENAI_BASE_URL=... \
//                      AZURE_OPENAI_MODEL=gpt-5.4 AZURE_OPENAI_API_VERSION=preview
//
// Client auth: Supabase's functions.invoke forwards the user's JWT as the
// Authorization header. We verify it below and use it to identify the
// participant. Writes use the service-role client so we bypass RLS for the
// messages table (which is read-only from the client).

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-client-info, apikey",
  "access-control-allow-methods": "POST, OPTIONS",
};

const AZURE_KEY = Deno.env.get("AZURE_OPENAI_API_KEY");
const AZURE_URL = Deno.env.get("AZURE_OPENAI_BASE_URL");
const AZURE_MODEL = Deno.env.get("AZURE_OPENAI_MODEL") ?? "gpt-5.4";
const AZURE_API_VERSION = Deno.env.get("AZURE_OPENAI_API_VERSION") ?? "preview";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SYSTEM_PROMPT =
  "You are a helpful, friendly assistant for a teenage user participating in a research study. " +
  "Be warm, concise, and age-appropriate. Do not ask for or store any personally identifying information. " +
  "If the user expresses serious distress or mentions self-harm, gently suggest reaching out to a trusted adult or a crisis resource.";

const HISTORY_WINDOW = 20; // last N turns sent to the model

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    if (!AZURE_KEY || !AZURE_URL) {
      return json({ error: "Server not configured (missing Azure secrets)" }, 500);
    }

    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing auth" }, 401);
    }

    // User-scoped client to identify the participant from their JWT.
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid session" }, 401);
    const participantId = userData.user.id;

    const body = await req.json().catch(() => null);
    const content = body?.content?.toString().trim();
    if (!content) return json({ error: "Empty message" }, 400);
    if (content.length > 8000) return json({ error: "Message too long" }, 400);

    // Service-role client bypasses RLS for writes.
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Persist the user's turn immediately.
    const { error: insUserErr } = await admin.from("messages").insert({
      participant_id: participantId,
      role: "user",
      content,
    });
    if (insUserErr) return json({ error: insUserErr.message }, 500);

    // Pull recent history for context.
    const { data: history, error: histErr } = await admin
      .from("messages")
      .select("role, content")
      .eq("participant_id", participantId)
      .order("created_at", { ascending: true })
      .limit(HISTORY_WINDOW * 2);
    if (histErr) return json({ error: histErr.message }, 500);

    const input = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history ?? []).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      })),
    ];

    // Azure OpenAI Responses API call.
    const azureRes = await fetch(
      `${AZURE_URL.replace(/\/$/, "")}/responses?api-version=${encodeURIComponent(AZURE_API_VERSION)}`,
      {
        method: "POST",
        headers: {
          "api-key": AZURE_KEY,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: AZURE_MODEL,
          input,
          reasoning: { effort: "high" },
        }),
      }
    );

    if (!azureRes.ok) {
      const errText = await azureRes.text();
      return json({ error: `Azure OpenAI ${azureRes.status}: ${errText.slice(0, 500)}` }, 502);
    }
    const azureData = await azureRes.json();
    const assistantText = extractText(azureData);
    if (!assistantText) {
      return json({ error: "Empty completion from model" }, 502);
    }

    // Persist assistant turn and return the saved row.
    const { data: saved, error: insAssistErr } = await admin
      .from("messages")
      .insert({
        participant_id: participantId,
        role: "assistant",
        content: assistantText,
      })
      .select()
      .single();
    if (insAssistErr) return json({ error: insAssistErr.message }, 500);

    return json({ message: saved });
  } catch (err) {
    console.error(err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

function extractText(resp: unknown): string {
  // Responses API exposes `output_text` as a convenience field.
  const r = resp as Record<string, unknown>;
  if (typeof r.output_text === "string" && r.output_text.length > 0) {
    return r.output_text;
  }
  // Fallback: traverse output[].content[].text
  const output = r.output as Array<{ content?: Array<{ type?: string; text?: string }> }> | undefined;
  if (Array.isArray(output)) {
    const chunks: string[] = [];
    for (const item of output) {
      for (const c of item.content ?? []) {
        if (c?.text) chunks.push(c.text);
      }
    }
    if (chunks.length) return chunks.join("\n");
  }
  return "";
}
