// ---------------------------------------------------------------------------
// Core integration adapter interface and abstract base classes.
//
// Every third-party integration implements IntegrationAdapter to plug into
// the Aura platform. Adapters are stateless singletons — credentials and
// context are passed as arguments, not held as internal state.
// ---------------------------------------------------------------------------

import type { OAuthConfig } from "./oauth";
import type { CredentialEnvelope, CredentialPayload } from "./credentials";
import type { VmSkillManifest } from "./vm-skill";

// ---------------------------------------------------------------------------
// Authentication strategy discriminator
// ---------------------------------------------------------------------------

/**
 * Determines which connection flow the integration uses.
 *
 * - `"oauth2"`:  Redirect-based OAuth 2.0 (Google, Slack, HubSpot, Salesforce, etc.)
 * - `"api_key"`: User-supplied API key or token (ElevenLabs, Datadog, etc.)
 * - `"webhook"`: Inbound webhook registration — no user credentials stored
 */
export type AuthStrategy = "oauth2" | "api_key" | "webhook";

// ---------------------------------------------------------------------------
// Credential validation result
// ---------------------------------------------------------------------------

/** Returned by `validateCredentials` to report whether stored creds are live. */
export interface ValidationResult {
  /** Whether the credentials are currently usable. */
  valid: boolean;

  /** Human-readable reason when invalid (e.g., "API key revoked", "Token expired"). */
  reason?: string;

  /** Provider-specific account metadata refreshed during validation. */
  accountInfo?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API-key connection input
// ---------------------------------------------------------------------------

/**
 * Shape of the POST body for `api_key` integrations.
 * Each adapter declares which fields it expects via `getApiKeyFields()`.
 */
export interface ApiKeyConnectionInput {
  /** Primary credential (API key, access token, etc.). */
  primaryKey: string;

  /** Optional secondary credential (application key, secret, etc.). */
  secondaryKey?: string;

  /**
   * Arbitrary additional fields the provider needs.
   * Example: `{ site: "datadoghq.com" }` for Datadog.
   */
  extras?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// API key field descriptor (for UI rendering)
// ---------------------------------------------------------------------------

/**
 * Describes a single credential field the user must fill in for `api_key`
 * integrations. The dashboard UI uses these to render the connection form.
 */
export interface ApiKeyFieldDescriptor {
  /**
   * Machine name for the field.
   * Use `"primaryKey"` or `"secondaryKey"` for the standard fields,
   * or any string for `extras` fields.
   */
  name: "primaryKey" | "secondaryKey" | string;

  /** Human label shown in the form (e.g., "API Key", "Application Key"). */
  label: string;

  /** Placeholder text. */
  placeholder?: string;

  /** Whether this field is required. */
  required: boolean;

  /** If true, the input is masked (password field). Default: true for keys. */
  secret?: boolean;

  /** Optional help text or documentation link. */
  helpText?: string;
}

// ---------------------------------------------------------------------------
// Chat tool definition (OpenAI function-calling format)
// ---------------------------------------------------------------------------

/**
 * A tool this integration exposes to the LLM when the agent runs in
 * fallback mode (Aura-side execution, no VM running).
 *
 * Uses the OpenAI function-calling schema, matching the existing pattern
 * in `src/lib/integrations/chat-tools.ts`.
 */
export interface ChatToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

// ---------------------------------------------------------------------------
// Token refresh result
// ---------------------------------------------------------------------------

/**
 * Returned by `IntegrationAdapter.refreshToken()`.
 *
 * Supports providers that rotate refresh tokens on each refresh
 * (e.g., Salesforce since Spring 2024). When `refreshToken` is present,
 * the framework atomically updates both tokens in the DB.
 */
export interface TokenRefreshResult {
  /** New access token. */
  accessToken: string;

  /** New token expiry. */
  tokenExpiry: Date;

  /**
   * New refresh token, if the provider rotated it.
   * When present, the old refresh token is replaced in the DB.
   * Required for Salesforce and other providers with refresh token rotation.
   */
  refreshToken?: string;
}

// ---------------------------------------------------------------------------
// The adapter interface
// ---------------------------------------------------------------------------

/**
 * `IntegrationAdapter` is the core abstraction for third-party integrations.
 *
 * Each provider implements this interface to handle its authentication flow,
 * credential lifecycle, VM-side skill generation, and chat tool execution.
 *
 * Adapters are stateless singletons — they receive credentials and context
 * as arguments rather than holding internal state.
 *
 * @typeParam TMetadata - Shape of the provider-specific metadata stored in
 *   the `integrations.metadata` JSONB column.
 */
export interface IntegrationAdapter<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> {
  // ---- Identity ----

  /**
   * Unique provider ID. Must match the `provider` column in the
   * `integrations` table and the `id` field in `IntegrationProvider`.
   */
  readonly id: string;

  /** Human-readable display name (e.g., "Google Workspace"). */
  readonly displayName: string;

  /** Which auth flow this integration uses. */
  readonly authStrategy: AuthStrategy;

  // ---- OAuth (only when authStrategy === "oauth2") ----

  /**
   * Returns the OAuth configuration for this provider.
   * Called by the generic OAuth initiation route.
   *
   * @returns OAuth config, or `null` if `authStrategy !== "oauth2"`.
   */
  getOAuthConfig(): OAuthConfig | null;

  // ---- API Key (only when authStrategy === "api_key") ----

  /**
   * Describes the form fields the user must fill in to connect.
   * Used by the dashboard UI to render the connection form.
   *
   * @returns Field descriptors, or `null` if `authStrategy !== "api_key"`.
   */
  getApiKeyFields(): ApiKeyFieldDescriptor[] | null;

  // ---- Connection lifecycle ----

  /**
   * Validate user-supplied API key credentials before storing.
   * Called during `POST /api/integrations/:provider` for api_key integrations.
   *
   * Should make a lightweight API call to the provider to confirm the key
   * is valid and extract account metadata.
   */
  validateApiKey?(
    input: ApiKeyConnectionInput,
  ): Promise<ValidationResult & { metadata?: TMetadata }>;

  /**
   * Process the raw OAuth token response into the shape we store.
   * Called after the generic callback exchanges the auth code for tokens.
   *
   * Allows the adapter to:
   * - Fetch user profile info (email, avatar, instance URL)
   * - Parse scopes into a normalized `string[]`
   * - Return provider-specific metadata
   *
   * @param tokens - Raw token response from the provider's token endpoint,
   *   plus any user info fetched from `OAuthConfig.userInfoUrl`.
   */
  processOAuthTokens?(tokens: Record<string, unknown>): Promise<{
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    scopes: string[];
    metadata: TMetadata;
  }>;

  /**
   * Validate that stored credentials are still usable.
   * Called on `GET /api/integrations/:provider` (status check).
   */
  validateCredentials(envelope: CredentialEnvelope): Promise<ValidationResult>;

  /**
   * Refresh an expired access token using the stored refresh token.
   *
   * Supports refresh token rotation: when the provider issues a new
   * refresh token (e.g., Salesforce), include it in the result and the
   * framework will atomically update both tokens in the DB.
   *
   * @returns New tokens + expiry, or `null` if refresh failed.
   */
  refreshToken?(envelope: CredentialEnvelope): Promise<TokenRefreshResult | null>;

  /**
   * Perform provider-specific cleanup when the user disconnects.
   * Examples: revoke OAuth tokens, deregister webhooks, delete bot users.
   * Called before the DB row is deleted.
   */
  onDisconnect?(envelope: CredentialEnvelope): Promise<void>;

  // ---- VM integration (optional) ----

  /**
   * Generate VM-side skill files for this integration.
   * Return `null` if this integration does not run on agent VMs.
   *
   * The manifest includes:
   * - Skill files (CLI tool, SKILL.md for OpenClaw)
   * - Credential receiver service
   * - Systemd unit files
   * - Caddy route configuration
   *
   * @param gatewayToken - The agent's gateway auth token for the credential receiver.
   */
  getVmSkillManifest?(gatewayToken: string): VmSkillManifest | null;

  /**
   * Build the credential payload to push to a running VM.
   * Called after OAuth callback or when an agent is provisioned with
   * this integration already connected.
   *
   * @returns JSON payload for the VM's credential receiver, or `null`
   *   if this integration does not push credentials to VMs.
   */
  buildVmCredentialPayload?(
    envelope: CredentialEnvelope,
  ): Promise<CredentialPayload | null>;

  // ---- Chat tools — fallback LLM path (optional) ----

  /**
   * Return OpenAI function-calling tool definitions for Aura-side execution.
   * Used when the agent has no running VM (fallback LLM path).
   *
   * @returns Tool definitions, or empty array if no tools are provided.
   */
  getChatTools(): ChatToolDefinition[];

  /**
   * Execute a chat tool call on the Aura server side.
   * Called by the fallback chat path when the LLM invokes one of this
   * integration's tools.
   *
   * @param toolName    - Function name from `getChatTools()`.
   * @param args        - Arguments parsed from the LLM's function call.
   * @param accessToken - Decrypted access token for API calls.
   * @returns Tool execution result (serialized back to the LLM).
   */
  executeChatTool?(
    toolName: string,
    args: Record<string, unknown>,
    accessToken: string,
  ): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Abstract base classes for convenience
// ---------------------------------------------------------------------------

/**
 * Base class for OAuth 2.0 integrations. Provides sensible defaults so
 * concrete adapters only override what they need.
 *
 * Subclasses must implement: `id`, `displayName`, `getOAuthConfig()`,
 * `processOAuthTokens()`, `validateCredentials()`.
 */
export abstract class OAuthAdapter<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> implements IntegrationAdapter<TMetadata>
{
  abstract readonly id: string;
  abstract readonly displayName: string;
  readonly authStrategy: AuthStrategy = "oauth2";

  abstract getOAuthConfig(): OAuthConfig;
  getApiKeyFields() {
    return null;
  }

  abstract processOAuthTokens(
    tokens: Record<string, unknown>,
  ): Promise<{
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: Date;
    scopes: string[];
    metadata: TMetadata;
  }>;

  abstract validateCredentials(
    envelope: CredentialEnvelope,
  ): Promise<ValidationResult>;

  getChatTools(): ChatToolDefinition[] {
    return [];
  }
}

/**
 * Base class for API-key integrations. Provides sensible defaults so
 * concrete adapters only override what they need.
 *
 * Subclasses must implement: `id`, `displayName`, `getApiKeyFields()`,
 * `validateApiKey()`, `validateCredentials()`.
 */
export abstract class ApiKeyAdapter<
  TMetadata extends Record<string, unknown> = Record<string, unknown>,
> implements IntegrationAdapter<TMetadata>
{
  abstract readonly id: string;
  abstract readonly displayName: string;
  readonly authStrategy: AuthStrategy = "api_key";

  getOAuthConfig() {
    return null;
  }
  abstract getApiKeyFields(): ApiKeyFieldDescriptor[];

  abstract validateApiKey(
    input: ApiKeyConnectionInput,
  ): Promise<ValidationResult & { metadata?: TMetadata }>;

  abstract validateCredentials(
    envelope: CredentialEnvelope,
  ): Promise<ValidationResult>;

  refreshToken() {
    return Promise.resolve(null);
  }

  getChatTools(): ChatToolDefinition[] {
    return [];
  }
}
