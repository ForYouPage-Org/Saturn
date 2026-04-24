// Azure OpenAI client wrapper. Uses the Vercel AI SDK's Azure provider so
// streaming works with assistant-ui's runtime out of the box.
//
// The earlier (Express) version hit Azure's Responses API directly. For this
// pilot we use Chat Completions via @ai-sdk/azure — the assistant-ui + AI
// SDK combo is the well-trodden path for streaming, and gpt-5.x supports
// both APIs. If we need Responses-specific features later we can swap the
// model factory below.

import { createAzure } from "@ai-sdk/azure";

const API_KEY = process.env.AZURE_OPENAI_API_KEY ?? "";
const MODEL = process.env.AZURE_OPENAI_MODEL ?? "gpt-5.4";
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION ?? "2024-10-21";
const RESOURCE_NAME = resolveResourceName();

function resolveResourceName(): string {
  if (process.env.AZURE_OPENAI_RESOURCE_NAME) {
    return process.env.AZURE_OPENAI_RESOURCE_NAME;
  }
  const base = process.env.AZURE_OPENAI_BASE_URL;
  if (!base) return "";
  try {
    const url = new URL(base);
    // host looks like "<resource>.openai.azure.com"
    return url.hostname.split(".")[0];
  } catch {
    return "";
  }
}

export function azureReady(): boolean {
  return Boolean(RESOURCE_NAME && API_KEY);
}

export function modelName(): string {
  return MODEL;
}

export function getAzureModel() {
  if (!azureReady()) {
    throw new Error(
      "Azure OpenAI not configured — set AZURE_OPENAI_API_KEY and AZURE_OPENAI_BASE_URL (or AZURE_OPENAI_RESOURCE_NAME)"
    );
  }
  const azure = createAzure({
    resourceName: RESOURCE_NAME,
    apiKey: API_KEY,
    apiVersion: API_VERSION,
  });
  return azure(MODEL);
}
