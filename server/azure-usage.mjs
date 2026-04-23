// Mercury-pilot's Azure usage logger.
//
// Writes one JSON line per /api/chat call to the same JSONL file the hub's
// azure-usage dashboard already reads. The hub's dashboard groups by
// `email` and aggregates tokens / cost — mercury-pilot entries show up as a
// separate user bucket keyed on the participant code.
//
// Env:
//   AZURE_USAGE_LOG_PATH — absolute path to the shared JSONL file.
//                          default: $MERCURY_ROOT/logs/azure_usage.jsonl
//                          on the iMac set this to the hub's log so the
//                          hub dashboard sees pilot traffic too.
//   AZURE_OPENAI_INPUT_PRICE_PER_M   default 1.25
//   AZURE_OPENAI_OUTPUT_PRICE_PER_M  default 10.0
// The two price env vars match the hub's names and defaults (gpt-5.x
// rate card) so one price table governs both apps.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_PATH = resolve(HERE, "..", "logs", "azure_usage.jsonl");
const LOG_PATH = process.env.AZURE_USAGE_LOG_PATH ?? DEFAULT_PATH;

const INPUT_PRICE_PER_M = Number(process.env.AZURE_OPENAI_INPUT_PRICE_PER_M ?? 1.25);
const OUTPUT_PRICE_PER_M = Number(process.env.AZURE_OPENAI_OUTPUT_PRICE_PER_M ?? 10.0);

export function estimateCostUsd(input, output) {
  const cost = (input * INPUT_PRICE_PER_M + output * OUTPUT_PRICE_PER_M) / 1_000_000;
  return Math.round(cost * 10_000) / 10_000;
}

/**
 * Append one call record in the same shape the hub's logAzureCall produces.
 * Schema is defined in _hub/web/src/lib/azure-usage.ts — keep in sync.
 *
 * @param {{
 *   participantCode: string,
 *   model: string,
 *   prompt: string,
 *   inputTokens: number,
 *   outputTokens: number,
 *   reasoningTokens: number,
 *   durationMs: number,
 *   error?: string,
 * }} params
 */
export function logCall(params) {
  const totalTokens = params.inputTokens + params.outputTokens;
  const entry = {
    ts: new Date(Date.now() - params.durationMs).toISOString(),
    email: `mercury-pilot:${params.participantCode}`,
    role: "pilot-participant",
    model: params.model,
    prompt: (params.prompt ?? "").slice(0, 2_000),
    hops: 1,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    reasoning_tokens: params.reasoningTokens,
    total_tokens: totalTokens,
    cost_usd: estimateCostUsd(params.inputTokens, params.outputTokens),
    duration_ms: params.durationMs,
    tools: [],
    contains_data: false,
    ...(params.error ? { error: params.error } : {}),
  };
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error(`[azure-usage log failed] ${err.message}`);
  }
}

export function usageLogPath() {
  return LOG_PATH;
}
