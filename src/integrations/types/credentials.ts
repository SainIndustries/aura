// ---------------------------------------------------------------------------
// Credential storage and transport types.
//
// These types describe how credentials flow through the system:
//   DB row → CredentialEnvelope → adapter methods → CredentialPayload → VM
// ---------------------------------------------------------------------------

/**
 * Application-level view of a stored integration credential.
 *
 * Wraps the DB `integrations` row with typed access. Encrypted and decrypted
 * values are kept separate to prevent accidental leakage in logs or responses.
 *
 * Adapters receive this when they need to validate, refresh, or build
 * VM payloads from stored credentials.
 */
export interface CredentialEnvelope {
  /** Database row ID (`integrations.id`). */
  integrationId: string;

  /** User who owns this integration (`integrations.userId`). */
  userId: string;

  /** Provider identifier (matches `IntegrationAdapter.id`). */
  provider: string;

  // ---- Encrypted values (as stored in DB) ----

  /** Encrypted access token / API key (AES-256-GCM via `encryptToken()`). */
  encryptedAccessToken: string | null;

  /** Encrypted refresh token — OAuth only. */
  encryptedRefreshToken: string | null;

  // ---- Decrypted values (populated on demand by the framework) ----

  /**
   * Decrypted access token. The framework populates this via `decryptToken()`
   * before passing the envelope to adapter methods that need the raw token.
   */
  accessToken: string | null;

  /**
   * Decrypted refresh token. Populated when the adapter needs to perform
   * a token refresh.
   */
  refreshToken: string | null;

  // ---- Token metadata ----

  /** When the access token expires (`null` for non-expiring API keys). */
  tokenExpiry: Date | null;

  /** Whether the access token is currently expired. */
  isExpired: boolean;

  /** OAuth scopes granted by the provider. */
  scopes: string[];

  /**
   * Provider-specific metadata stored in the JSONB column.
   *
   * Examples:
   * - Google: `{ email, name, picture }`
   * - ElevenLabs: `{ userId, subscription, characterCount, characterLimit }`
   * - Salesforce: `{ email, instance_url, org_id }`
   * - HubSpot: `{ portal_id, hub_domain, user_email }`
   */
  metadata: Record<string, unknown>;

  /** When the integration was first connected. */
  connectedAt: Date | null;
}

/**
 * Input shape for constructing a `CredentialEnvelope` from a DB row.
 * Used by the framework's envelope factory helper.
 */
export interface CredentialEnvelopeOptions {
  integrationId: string;
  userId: string;
  provider: string;
  encryptedAccessToken: string | null;
  encryptedRefreshToken: string | null;
  tokenExpiry: Date | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  connectedAt: Date | null;
}

/**
 * Credential payload sent to a VM's credential receiver endpoint.
 *
 * Built by `IntegrationAdapter.buildVmCredentialPayload()` and POSTed to the
 * VM's Caddy route (e.g., `/internal/google-credentials`).
 *
 * The `data` shape is provider-specific — each adapter defines what the
 * VM-side credential receiver expects.
 */
export interface CredentialPayload {
  /** Provider name, used for routing on the VM side. */
  provider: string;

  /**
   * Provider-specific credential data.
   *
   * Examples:
   * - Google: `{ email, accessToken, refreshToken, tokenExpiry, clientId, clientSecret }`
   * - Slack: `{ botToken, teamId, teamName }`
   */
  data: Record<string, unknown>;
}

/**
 * Result of a credential storage operation (connect or refresh).
 */
export interface CredentialStoreResult {
  /** Whether this was a new connection or an update to an existing one. */
  action: "created" | "updated";

  /** The `integrations` table row ID. */
  integrationId: string;
}
