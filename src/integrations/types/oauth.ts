// ---------------------------------------------------------------------------
// OAuth 2.0 configuration types for the integration adapter framework.
//
// These types capture everything the generic OAuth route handlers need to
// initiate and complete an OAuth flow without provider-specific code.
// ---------------------------------------------------------------------------

/**
 * OAuth 2.0 grant types supported by the framework.
 */
export type OAuthGrantType = "authorization_code" | "client_credentials";

/**
 * How scopes are serialized in the authorization URL.
 * - Google, Microsoft: space-delimited (" ")
 * - Slack: comma-delimited (",")
 * - Some legacy providers: plus-delimited ("+")
 */
export type ScopeDelimiter = " " | "," | "+";

/**
 * Complete OAuth 2.0 configuration for a provider.
 *
 * The generic OAuth route handler reads this to build the authorization URL,
 * exchange the auth code for tokens, and optionally fetch user profile info.
 *
 * Reuses the existing CSRF state mechanism from `src/lib/integrations/oauth-state.ts`.
 */
export interface OAuthConfig {
  // ---- Provider endpoints ----

  /** Full URL to the provider's authorization page. */
  authorizationUrl: string;

  /** Full URL to the provider's token exchange endpoint. */
  tokenUrl: string;

  /**
   * Optional URL to fetch user profile info after token exchange.
   * If provided, the generic callback GETs this URL with the access token
   * in the Authorization header and passes the response body to
   * `processOAuthTokens()` as part of the raw token data.
   */
  userInfoUrl?: string;

  // ---- Client credentials (read from env vars at runtime) ----

  /**
   * Environment variable name for the client ID.
   * Example: "GOOGLE_CLIENT_ID", "SLACK_CLIENT_ID".
   */
  clientIdEnvVar: string;

  /**
   * Environment variable name for the client secret.
   * Example: "GOOGLE_CLIENT_SECRET", "SLACK_CLIENT_SECRET".
   */
  clientSecretEnvVar: string;

  // ---- Redirect ----

  /**
   * Override the callback path if the provider requires an exact redirect URI.
   * Default: `/api/integrations/${adapter.id}/callback`
   */
  redirectPath?: string;

  // ---- Scopes ----

  /** OAuth scopes to request. */
  scopes: string[];

  /** Delimiter used to join scopes in the authorization URL. Default: " ". */
  scopeDelimiter?: ScopeDelimiter;

  /**
   * Query parameter name for scopes. Default: "scope".
   * Some providers use "scopes" (plural).
   */
  scopeParamName?: string;

  // ---- Grant details ----

  /** OAuth grant type. Default: "authorization_code". */
  grantType?: OAuthGrantType;

  /**
   * Whether to request offline access (refresh token).
   * Adds `access_type=offline` for Google-style providers.
   */
  requestOfflineAccess?: boolean;

  /**
   * Whether to force the consent screen every time.
   * Adds `prompt=consent` for Google-style providers.
   */
  forceConsent?: boolean;

  // ---- Extra parameters ----

  /**
   * Additional query parameters appended to the authorization URL.
   * Example: `{ "response_mode": "query" }` for certain providers.
   */
  extraAuthParams?: Record<string, string>;

  /**
   * Additional form parameters sent with the token exchange request.
   */
  extraTokenParams?: Record<string, string>;

  // ---- Token response parsing ----

  /**
   * How the provider formats the token response body.
   * - "json": Standard JSON body (default, most providers)
   * - "form": URL-encoded form body (legacy GitHub Apps)
   */
  tokenResponseFormat?: "json" | "form";

  /**
   * How the client authenticates to the token endpoint.
   * - "post": client_id/client_secret in the POST body (default)
   * - "basic": HTTP Basic auth header (some enterprise providers)
   */
  tokenEndpointAuthMethod?: "post" | "basic";
}

/**
 * Normalized token response passed to `IntegrationAdapter.processOAuthTokens()`.
 *
 * The generic callback handler parses the raw provider response into this
 * shape before handing it to the adapter for provider-specific processing.
 */
export interface OAuthTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;

  /** The full raw response for provider-specific fields. */
  raw: Record<string, unknown>;
}
