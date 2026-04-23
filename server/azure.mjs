// Thin client for Azure OpenAI Responses API.
// Returns assistant text + usage + timing so the caller can log it.

const KEY = process.env.AZURE_OPENAI_API_KEY;
const BASE = process.env.AZURE_OPENAI_BASE_URL;
const MODEL = process.env.AZURE_OPENAI_MODEL ?? "gpt-5.4";
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION ?? "preview";
const REASONING_EFFORT = process.env.AZURE_OPENAI_REASONING_EFFORT ?? "high";

export function isConfigured() {
  return Boolean(KEY && BASE);
}

export function modelName() {
  return MODEL;
}

/**
 * @returns {Promise<{
 *   text: string,
 *   inputTokens: number,
 *   outputTokens: number,
 *   reasoningTokens: number,
 *   durationMs: number,
 * }>}
 */
export async function complete(messages) {
  if (!isConfigured()) {
    throw new Error(
      "Azure OpenAI not configured — set AZURE_OPENAI_API_KEY and AZURE_OPENAI_BASE_URL"
    );
  }
  const url = `${BASE.replace(/\/$/, "")}/responses?api-version=${encodeURIComponent(API_VERSION)}`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      input: messages,
      reasoning: { effort: REASONING_EFFORT },
    }),
  });
  const durationMs = Date.now() - t0;
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Azure OpenAI ${res.status}: ${text.slice(0, 500)}`);
    err.durationMs = durationMs;
    throw err;
  }
  const data = await res.json();
  return {
    text: extractText(data),
    inputTokens: data?.usage?.input_tokens ?? 0,
    outputTokens: data?.usage?.output_tokens ?? 0,
    reasoningTokens: data?.usage?.output_tokens_details?.reasoning_tokens ?? 0,
    durationMs,
  };
}

function extractText(resp) {
  if (typeof resp?.output_text === "string" && resp.output_text.length > 0) {
    return resp.output_text;
  }
  const chunks = [];
  for (const item of resp?.output ?? []) {
    for (const c of item?.content ?? []) {
      if (typeof c?.text === "string") chunks.push(c.text);
    }
  }
  return chunks.join("\n");
}
