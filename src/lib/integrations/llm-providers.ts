/**
 * Shared BYOK (Bring Your Own Key) LLM provider constants.
 * Single source of truth for API route, wizard UI, and provisioning.
 */

export const LLM_PROVIDER_IDS = ["openai", "anthropic", "google", "xai", "groq"] as const;
export type LlmProviderId = (typeof LLM_PROVIDER_IDS)[number];

// ---------------------------------------------------------------------------
// Auth method definitions — how a user can authenticate with a provider
// ---------------------------------------------------------------------------

export type AuthMethodId = "api-key" | "setup-token";

export interface AuthMethod {
  id: AuthMethodId;
  label: string;
  description: string;
  placeholder: string;
  docsUrl: string;
  /** Whether we can validate the credential before saving */
  validate: boolean;
  /** How the credential gets onto the VM */
  provisioningMode: "env-var" | "paste-token";
}

export interface LlmProviderDef {
  id: LlmProviderId;
  name: string;
  /** Integration table key — prefixed to avoid conflicts with tool integrations like "google" */
  integrationKey: string;
  /** Env var name expected by OpenClaw on the VM */
  envVar: string;
  /** URL to hit for key validation */
  validationUrl: string;
  /** Build fetch headers/URL for validation. Returns { headers, url } — url overrides validationUrl when the key goes in a query param (Google). */
  buildValidationRequest: (apiKey: string) => { url: string; headers: Record<string, string> };
  /** Link to the provider's API key management page */
  docsUrl: string;
  icon: string;
  models: { id: string; name: string; description: string }[];
  /** Supported auth methods — first entry is the default */
  authMethods: AuthMethod[];
}

/** Helper to build the standard API key auth method for a provider */
function apiKeyMethod(providerName: string, docsUrl: string): AuthMethod {
  return {
    id: "api-key",
    label: "API Key",
    description: `Use a ${providerName} API key`,
    placeholder: `Paste your ${providerName} API key`,
    docsUrl,
    validate: true,
    provisioningMode: "env-var",
  };
}

export const LLM_PROVIDERS: Record<LlmProviderId, LlmProviderDef> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    integrationKey: "llm-openai",
    envVar: "OPENAI_API_KEY",
    validationUrl: "https://api.openai.com/v1/models",
    buildValidationRequest: (apiKey) => ({
      url: "https://api.openai.com/v1/models",
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
    docsUrl: "https://platform.openai.com/api-keys",
    icon: "🤖",
    models: [
      { id: "gpt-4.1", name: "GPT-4.1", description: "Latest and most capable" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Fast and affordable" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", description: "Fastest, lowest cost" },
      { id: "o3", name: "o3", description: "Advanced reasoning model" },
      { id: "o4-mini", name: "o4-mini", description: "Fast reasoning model" },
    ],
    authMethods: [apiKeyMethod("OpenAI", "https://platform.openai.com/api-keys")],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    integrationKey: "llm-anthropic",
    envVar: "ANTHROPIC_API_KEY",
    validationUrl: "https://api.anthropic.com/v1/models",
    buildValidationRequest: (apiKey) => ({
      url: "https://api.anthropic.com/v1/models",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    }),
    docsUrl: "https://console.anthropic.com/settings/keys",
    icon: "🧠",
    models: [
      { id: "claude-opus-4.6", name: "Claude Opus 4.6", description: "Most capable, best for complex tasks" },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", description: "Excellent balance of speed and quality" },
      { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", description: "Fast and efficient" },
    ],
    authMethods: [
      apiKeyMethod("Anthropic", "https://console.anthropic.com/settings/keys"),
      {
        id: "setup-token",
        label: "Setup Token",
        description: "Use your existing Claude subscription",
        placeholder: "Paste your setup token from `claude setup-token`...",
        docsUrl: "https://docs.anthropic.com/en/docs/claude-code/setup-token",
        validate: false,
        provisioningMode: "paste-token",
      },
    ],
  },
  google: {
    id: "google",
    name: "Google",
    integrationKey: "llm-google",
    envVar: "GOOGLE_API_KEY",
    validationUrl: "https://generativelanguage.googleapis.com/v1/models",
    buildValidationRequest: (apiKey) => ({
      url: `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      headers: {},
    }),
    docsUrl: "https://aistudio.google.com/apikey",
    icon: "✨",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Most capable, advanced reasoning" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast and cost-effective" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Lightweight, low latency" },
    ],
    authMethods: [apiKeyMethod("Google", "https://aistudio.google.com/apikey")],
  },
  xai: {
    id: "xai",
    name: "xAI",
    integrationKey: "llm-xai",
    envVar: "XAI_API_KEY",
    validationUrl: "https://api.x.ai/v1/models",
    buildValidationRequest: (apiKey) => ({
      url: "https://api.x.ai/v1/models",
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
    docsUrl: "https://console.x.ai",
    icon: "🅧",
    models: [
      { id: "grok-3", name: "Grok 3", description: "Most capable xAI model" },
      { id: "grok-3-mini", name: "Grok 3 Mini", description: "Fast reasoning model" },
    ],
    authMethods: [apiKeyMethod("xAI", "https://console.x.ai")],
  },
  groq: {
    id: "groq",
    name: "Groq",
    integrationKey: "llm-groq",
    envVar: "GROQ_API_KEY",
    validationUrl: "https://api.groq.com/openai/v1/models",
    buildValidationRequest: (apiKey) => ({
      url: "https://api.groq.com/openai/v1/models",
      headers: { Authorization: `Bearer ${apiKey}` },
    }),
    docsUrl: "https://console.groq.com/keys",
    icon: "⚡",
    models: [
      { id: "llama-4-maverick-17b-128e", name: "Llama 4 Maverick", description: "Latest Meta model, ultra fast" },
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Open source, versatile" },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 70B", description: "Strong reasoning, open source" },
    ],
    authMethods: [apiKeyMethod("Groq", "https://console.groq.com/keys")],
  },
};

/** Look up provider def by its integration key (e.g. "llm-openai" → openai provider) */
export function getProviderByIntegrationKey(key: string): LlmProviderDef | undefined {
  return Object.values(LLM_PROVIDERS).find((p) => p.integrationKey === key);
}

/** Check if a string is a valid BYOK provider id */
export function isByokProvider(id: string): id is LlmProviderId {
  return LLM_PROVIDER_IDS.includes(id as LlmProviderId);
}
