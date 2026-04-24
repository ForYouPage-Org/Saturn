// Mercury-pilot's Azure usage logger. Appends one JSONL line per chat call
// to the file at AZURE_USAGE_LOG_PATH (default: ./logs/azure_usage.jsonl).
// On the iMac, set AZURE_USAGE_LOG_PATH to the hub's log path so the
// /admin/azure-usage dashboard picks up pilot traffic automatically.
//
// Schema is defined in _hub/web/src/lib/azure-usage.ts — keep this in sync.

import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_PATH = resolve(process.cwd(), "logs", "azure_usage.jsonl");
const LOG_PATH = process.env.AZURE_USAGE_LOG_PATH ?? DEFAULT_PATH;

const INPUT_PRICE_PER_M = Number(process.env.AZURE_OPENAI_INPUT_PRICE_PER_M ?? 1.25);
const OUTPUT_PRICE_PER_M = Number(process.env.AZURE_OPENAI_OUTPUT_PRICE_PER_M ?? 10.0);

export function estimateCostUsd(input: number, output: number): number {
  const cost = (input * INPUT_PRICE_PER_M + output * OUTPUT_PRICE_PER_M) / 1_000_000;
  return Math.round(cost * 10_000) / 10_000;
}

export type AzureCallLog = {
  participantCode: string;
  model: string;
  prompt: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  durationMs: number;
  error?: string;
};

export function logCall(params: AzureCallLog): void {
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
    tools: [] as never[],
    contains_data: false,
    ...(params.error ? { error: params.error } : {}),
  };
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    appendFileSync(LOG_PATH, JSON.stringify(entry) + "\n");
  } catch (err) {
    console.error(`[azure-usage log failed] ${(err as Error).message}`);
  }
}

export function usageLogPath(): string {
  return LOG_PATH;
}
