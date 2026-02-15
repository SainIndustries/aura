// ---------------------------------------------------------------------------
// Barrel export for the integration adapter type system.
// ---------------------------------------------------------------------------

// Core adapter interface, base classes, and supporting types
export type {
  AuthStrategy,
  ValidationResult,
  ApiKeyConnectionInput,
  ApiKeyFieldDescriptor,
  ChatToolDefinition,
  TokenRefreshResult,
  IntegrationAdapter,
} from "./adapter";
export { OAuthAdapter, ApiKeyAdapter } from "./adapter";

// OAuth 2.0 configuration types
export type {
  OAuthGrantType,
  ScopeDelimiter,
  OAuthConfig,
  OAuthTokenResponse,
} from "./oauth";

// Credential storage and transport types
export type {
  CredentialEnvelope,
  CredentialEnvelopeOptions,
  CredentialPayload,
  CredentialStoreResult,
} from "./credentials";

// VM-side skill types
export type {
  VmWriteFile,
  VmSystemdService,
  VmCaddyRoute,
  VmSkillManifest,
} from "./vm-skill";
