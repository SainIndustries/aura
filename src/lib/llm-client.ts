import OpenAI from "openai";

/**
 * Get a fallback LLM client for when no running OpenClaw instance exists.
 * Prefers OpenRouter (Claude), falls back to OpenAI.
 * Creates a fresh client each call so env vars are always respected.
 */
export function getFallbackLLM(): { client: OpenAI; model: string } | null {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      client: new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultHeaders: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://aura.so",
          "X-Title": "Aura",
        },
      }),
      model: "anthropic/claude-sonnet-4.5",
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: "gpt-4.1-mini",
    };
  }
  return null;
}
