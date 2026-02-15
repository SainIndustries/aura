# Aura Integration Framework Architecture

## 1. Overview

The Aura integration framework provides a unified abstraction for connecting third-party services to AI agents. Every integration — whether it uses OAuth 2.0 (Google, Slack, HubSpot, Salesforce) or API keys (ElevenLabs, Datadog) — implements the same `IntegrationAdapter` interface.

The framework handles:

- **Authentication flows** — OAuth 2.0 redirect-based or API key submission
- **Credential lifecycle** — encrypted storage, automatic refresh, revocation
- **VM-side skills** — generating OpenClaw skill files for agent VMs
- **Credential push** — delivering tokens to running agent instances
- **Service discovery** — registering and looking up available integrations
- **Chat tools** — fallback LLM tool execution when no VM is running

### Design Principles

1. **No DB schema changes** — the existing `integrations` table has all needed columns
2. **Stateless adapters** — credentials passed as arguments, not held internally
3. **Reuse existing utilities** — adapters import from `src/lib/integrations/` (encryption, OAuth state, token refresh)
4. **Backwards-compatible** — existing Google and ElevenLabs integrations are expressible as adapters
5. **Incremental adoption** — new integrations use adapters; existing ones can be migrated gradually

---

## 2. Existing Integration Patterns

### 2.1 Google Workspace (OAuth 2.0 + VM skill)

The most complete integration, exercising every capability:

| Component | File |
|-----------|------|
| OAuth initiation | `src/app/api/integrations/google/route.ts` |
| OAuth callback | `src/app/api/integrations/google/callback/route.ts` |
| Token refresh | `src/lib/integrations/token-refresh.ts` |
| Credential push | `src/lib/integrations/credential-push.ts` |
| VM skill files | `src/lib/provisioning/vm-google-skill.ts` |
| Chat tools (fallback) | `src/lib/integrations/chat-tools.ts` |
| State/CSRF | `src/lib/integrations/oauth-state.ts` |
| Encryption | `src/lib/integrations/encryption.ts` |

**Flow:**
1. User clicks "Connect Google" → redirect to Google OAuth consent screen
2. Google redirects back with auth code → callback exchanges for tokens
3. Tokens encrypted (AES-256-GCM) and stored in `integrations` table
4. Credentials pushed to all running agent VMs via `/internal/google-credentials`
5. VM-side skill (CLI + SKILL.md) enables OpenClaw to use Gmail/Calendar natively
6. Fallback path: Aura-side tool execution via OpenAI function-calling format

### 2.2 ElevenLabs (API Key)

A simpler pattern — no OAuth, no VM skill:

| Component | File |
|-----------|------|
| API key CRUD | `src/app/api/integrations/elevenlabs/route.ts` |
| Voice settings | `src/app/api/voice-settings/route.ts` |
| Voice chat hook | `src/hooks/use-voice-chat.ts` |
| LLM proxy | `src/app/api/voice/llm-proxy/route.ts` |

**Flow:**
1. User submits API key → validated against `api.elevenlabs.io/v1/user`
2. Key encrypted and stored in `integrations` table with `provider: "elevenlabs"`
3. Used server-side only (voice ConvAI agent creation, signed URLs)
4. No credential push to VMs — ElevenLabs runs through Aura's LLM proxy

### 2.3 Key Differences

| Aspect | Google (OAuth) | ElevenLabs (API Key) |
|--------|---------------|---------------------|
| Auth flow | Redirect-based | Form submission |
| Token refresh | Yes (refresh_token grant) | No |
| VM skill | Yes (CLI + SKILL.md + cred-receiver) | No |
| Chat tools | Yes (5 Gmail/Calendar tools) | No |
| Credential push | Yes (to all running VMs) | No |
| Provider-specific tables | No | Yes (voiceSettings) |

---

## 3. Adapter Interface

### 3.1 Type Location

All types live in `src/integrations/types/`:

```
src/integrations/types/
  adapter.ts      — IntegrationAdapter interface + base classes
  oauth.ts        — OAuthConfig, OAuthTokenResponse
  credentials.ts  — CredentialEnvelope, CredentialPayload
  vm-skill.ts     — VmSkillManifest, VmWriteFile, etc.
  index.ts        — barrel export
```

### 3.2 IntegrationAdapter Interface

```typescript
interface IntegrationAdapter<TMetadata> {
  // Identity
  readonly id: string;           // matches integrations.provider column
  readonly displayName: string;
  readonly authStrategy: AuthStrategy; // "oauth2" | "api_key" | "webhook"

  // OAuth config (null for non-OAuth)
  getOAuthConfig(): OAuthConfig | null;

  // API key fields (null for non-API-key)
  getApiKeyFields(): ApiKeyFieldDescriptor[] | null;

  // Connection lifecycle
  validateApiKey?(input): Promise<ValidationResult & { metadata? }>;
  processOAuthTokens?(tokens): Promise<{ accessToken, refreshToken?, tokenExpiry?, scopes, metadata }>;
  validateCredentials(envelope): Promise<ValidationResult>;
  refreshToken?(envelope): Promise<TokenRefreshResult | null>;
  onDisconnect?(envelope): Promise<void>;

  // VM integration (optional)
  getVmSkillManifest?(gatewayToken): VmSkillManifest | null;
  buildVmCredentialPayload?(envelope): Promise<CredentialPayload | null>;

  // Chat tools — fallback (optional)
  getChatTools(): ChatToolDefinition[];
  executeChatTool?(toolName, args, accessToken): Promise<unknown>;
}
```

### 3.3 Base Classes

Two abstract base classes provide sensible defaults:

- **`OAuthAdapter`** — sets `authStrategy = "oauth2"`, returns `null` from `getApiKeyFields()`, empty `getChatTools()`
- **`ApiKeyAdapter`** — sets `authStrategy = "api_key"`, returns `null` from `getOAuthConfig()`, no-op `refreshToken()`

Concrete adapters extend one of these and only implement what they need.

---

## 4. OAuth Flow Design

### 4.1 Generic OAuth Route Handlers

Instead of hand-writing per-provider route files, the framework provides two generic route handler factories.

#### Initiation: `GET /api/integrations/:provider`

1. Authenticate user via `getCurrentUser()`
2. Look up adapter from the registry by provider ID
3. Call `adapter.getOAuthConfig()` to get the provider's OAuth parameters
4. Call `generateState(userId, agentId)` from existing `oauth-state.ts`
5. Build authorization URL from `OAuthConfig`:
   - Set `client_id` from `process.env[config.clientIdEnvVar]`
   - Set `redirect_uri` from `config.redirectPath` or default
   - Join scopes with `config.scopeDelimiter` (default: space)
   - Add `access_type=offline` if `config.requestOfflineAccess`
   - Add `prompt=consent` if `config.forceConsent`
   - Append `config.extraAuthParams`
6. Redirect user to the authorization URL

#### Callback: `GET /api/integrations/:provider/callback`

1. Validate CSRF state via `validateState()` from existing `oauth-state.ts`
2. Exchange auth code for tokens using `OAuthConfig.tokenUrl`:
   - Support `tokenEndpointAuthMethod: "post"` (default) or `"basic"`
   - Support `tokenResponseFormat: "json"` (default) or `"form"`
3. Optionally fetch user info from `OAuthConfig.userInfoUrl`
4. Call `adapter.processOAuthTokens(rawResponse)` to get normalized data
5. Encrypt tokens via existing `encryptToken()` from `encryption.ts`
6. Upsert into the `integrations` table (preserve existing refresh token if provider didn't return a new one)
7. If adapter has `buildVmCredentialPayload()`, push to running VMs
8. Auto-enable integration on agent if `agentId` was in state
9. Return popup-closing HTML response

### 4.2 OAuthConfig Examples

**Google:**
```typescript
{
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
  clientIdEnvVar: "GOOGLE_CLIENT_ID",
  clientSecretEnvVar: "GOOGLE_CLIENT_SECRET",
  scopes: ["calendar.readonly", "calendar.events", "gmail.readonly", "gmail.send", ...],
  requestOfflineAccess: true,
  forceConsent: true,
}
```

**Slack:**
```typescript
{
  authorizationUrl: "https://slack.com/oauth/v2/authorize",
  tokenUrl: "https://slack.com/api/oauth.v2.access",
  clientIdEnvVar: "SLACK_CLIENT_ID",
  clientSecretEnvVar: "SLACK_CLIENT_SECRET",
  scopes: ["chat:write", "channels:read", "users:read", ...],
  scopeDelimiter: ",",
  scopeParamName: "scope",  // Slack uses user_scope for user tokens
}
```

**HubSpot:**
```typescript
{
  authorizationUrl: "https://app.hubspot.com/oauth/authorize",
  tokenUrl: "https://api.hubapi.com/oauth/v1/token",
  clientIdEnvVar: "HUBSPOT_CLIENT_ID",
  clientSecretEnvVar: "HUBSPOT_CLIENT_SECRET",
  scopes: ["crm.objects.contacts.read", "crm.objects.deals.read", ...],
  requestOfflineAccess: true,
}
```

**Salesforce:**
```typescript
{
  authorizationUrl: "https://login.salesforce.com/services/oauth2/authorize",
  tokenUrl: "https://login.salesforce.com/services/oauth2/token",
  clientIdEnvVar: "SALESFORCE_CLIENT_ID",
  clientSecretEnvVar: "SALESFORCE_CLIENT_SECRET",
  scopes: ["api", "refresh_token", "offline_access"],
  requestOfflineAccess: true,
  // Note: instance_url comes from token response, stored in metadata
}
```

---

## 5. Credential Storage Strategy

### 5.1 Database (No Changes Required)

The existing `integrations` table already has all needed columns:

```sql
integrations (
  id          UUID PK,
  userId      UUID FK → users,
  provider    TEXT,           -- adapter.id: "google", "slack", "hubspot", etc.
  accessToken TEXT,           -- encrypted via AES-256-GCM
  refreshToken TEXT,          -- encrypted, nullable (API keys don't have one)
  tokenExpiry TIMESTAMP,      -- nullable (API keys may not expire)
  scopes      TEXT[],         -- granted scopes
  metadata    JSONB,          -- provider-specific data (see below)
  connectedAt TIMESTAMP,
  createdAt   TIMESTAMP,
  updatedAt   TIMESTAMP
)
```

### 5.2 Metadata Column Usage

The `metadata` JSONB column stores provider-specific information. Each adapter defines its own metadata shape:

| Provider | Metadata Fields |
|----------|----------------|
| Google | `{ email, name, picture }` |
| ElevenLabs | `{ userId, subscription, characterCount, characterLimit }` |
| Salesforce | `{ email, instance_url, org_id }` |
| HubSpot | `{ portal_id, hub_domain, user_email }` |
| Slack | `{ team_id, team_name, bot_user_id }` |

**Important:** Instance-specific base URLs (like Salesforce's `instance_url`) are stored in metadata, not as separate columns.

### 5.3 CredentialEnvelope

The `CredentialEnvelope` type wraps a DB row with typed access. It separates encrypted values from decrypted values to prevent accidental leakage:

```typescript
interface CredentialEnvelope {
  integrationId: string;     // DB row ID
  userId: string;
  provider: string;

  // Encrypted (as stored in DB)
  encryptedAccessToken: string | null;
  encryptedRefreshToken: string | null;

  // Decrypted (populated on demand by the framework)
  accessToken: string | null;
  refreshToken: string | null;

  // Metadata
  tokenExpiry: Date | null;
  isExpired: boolean;        // computed: tokenExpiry < now
  scopes: string[];
  metadata: Record<string, unknown>;
  connectedAt: Date | null;
}
```

The framework constructs envelopes from DB rows and decrypts tokens only when an adapter method needs them, minimizing exposure of raw credentials.

### 5.4 Token Refresh with Rotation

Some providers (notably Salesforce since Spring 2024) issue a new refresh token with each refresh, auto-revoking the old one. The `refreshToken()` return type supports this:

```typescript
interface TokenRefreshResult {
  accessToken: string;
  tokenExpiry: Date;
  refreshToken?: string;  // present when provider rotated the refresh token
}
```

When `refreshToken` is present in the result, the framework atomically updates both `accessToken` and `refreshToken` in the DB.

---

## 6. VM Skill Provisioning

### 6.1 How It Works Today (Google)

The provisioning system in `src/lib/provisioning/hetzner.ts` hard-codes Google skill generation:

1. Calls `generateGoogleApiJs()` — Node.js CLI wrapping Gmail/Calendar APIs
2. Calls `generateSkillMd()` — OpenClaw skill description
3. Calls `generateCredReceiverJs(gatewayToken)` — HTTP server for credential injection
4. Writes all three to cloud-init `write_files` entries
5. Adds systemd service for cred-receiver
6. Adds Caddy route: `/internal/google-credentials` → `localhost:18790`
7. Adds `/root/google-workspace-skill` to OpenClaw's `skills.load.extraDirs`

### 6.2 Generalized Approach (VmSkillManifest)

Each adapter that runs on the VM returns a `VmSkillManifest`:

```typescript
interface VmSkillManifest {
  skillDirName: string;           // e.g., "google-workspace-skill"
  writeFiles: VmWriteFile[];      // cloud-init write_files entries
  services: VmSystemdService[];   // systemd units to install
  caddyRoutes: VmCaddyRoute[];    // Caddy reverse proxy rules
  prePopulatedCredentials?: VmWriteFile | null;
}
```

During provisioning, `hetzner.ts` will:

1. For each connected integration, call `adapter.getVmSkillManifest(gatewayToken)`
2. Collect all manifests that return non-null
3. Merge all `writeFiles` into the cloud-init `write_files:` block
4. Generate systemd unit files for each service
5. Build the Caddy config from all routes
6. Add all `skillDirName` paths to OpenClaw's `skills.load.extraDirs`

If the user already has credentials, call `adapter.buildVmCredentialPayload()` and add the pre-populated credential file.

### 6.3 Adding a New VM-Capable Integration

Example: adding a Slack bot skill to the VM.

```typescript
class SlackAdapter extends OAuthAdapter<SlackMetadata> {
  getVmSkillManifest(gatewayToken: string): VmSkillManifest {
    return {
      skillDirName: "slack-skill",
      writeFiles: [
        {
          path: "/root/slack-skill/slack-api.js",
          content: generateSlackApiJs(),
          permissions: "0755",
        },
        {
          path: "/root/slack-skill/SKILL.md",
          content: generateSlackSkillMd(),
        },
        {
          path: "/root/slack-cred-receiver/server.js",
          content: generateSlackCredReceiverJs(gatewayToken),
          permissions: "0755",
        },
      ],
      services: [
        {
          name: "slack-cred-receiver",
          unitFileContent: `[Unit]
Description=Slack Credential Receiver
After=network.target

[Service]
ExecStart=/usr/bin/node /root/slack-cred-receiver/server.js
Restart=always

[Install]
WantedBy=multi-user.target`,
        },
      ],
      caddyRoutes: [
        {
          matchPath: "/internal/slack-credentials",
          upstreamPort: 18791,
          rewritePath: "/credentials/slack",
        },
      ],
    };
  }
}
```

---

## 7. Credential Push to Running VMs

### 7.1 Current Implementation (Google-specific)

`src/lib/integrations/credential-push.ts` pushes Google credentials to all running VMs:

1. Fetches the user's Google integration from DB
2. Decrypts access/refresh tokens
3. For each running agent instance, POSTs to `http://{serverIp}/internal/google-credentials`

### 7.2 Generalized Implementation

The framework will provide a generic `pushCredentialsToRunningInstances(userId, provider)`:

1. Fetch the integration row for `(userId, provider)`
2. Construct a `CredentialEnvelope` from the DB row
3. Look up the adapter by provider ID
4. Call `adapter.buildVmCredentialPayload(envelope)` to get the payload
5. Use the adapter's `VmSkillManifest.caddyRoutes` to determine the push endpoint path
6. Iterate over all running agent instances for this user
7. POST the payload to each VM's Caddy endpoint

```typescript
async function pushCredentialsToRunningInstances(
  userId: string,
  provider: string,
): Promise<void> {
  const adapter = registry.getOrThrow(provider);
  if (!adapter.buildVmCredentialPayload) return;

  const integration = await db.query.integrations.findFirst({
    where: and(eq(integrations.userId, userId), eq(integrations.provider, provider)),
  });
  if (!integration?.accessToken) return;

  const envelope = buildEnvelope(integration); // decrypts tokens
  const payload = await adapter.buildVmCredentialPayload(envelope);
  if (!payload) return;

  // Determine the push endpoint from the adapter's VM manifest
  const manifest = adapter.getVmSkillManifest?.(""); // token not needed for route info
  const route = manifest?.caddyRoutes[0];
  const pushPath = route?.matchPath ?? `/internal/${provider}-credentials`;

  // Push to all running instances
  const userAgents = await db.query.agents.findMany({
    where: eq(agents.userId, userId),
    with: { instances: true },
  });

  for (const agent of userAgents) {
    const gatewayToken = (agent.config as any)?.gatewayToken;
    if (!gatewayToken) continue;

    for (const instance of agent.instances ?? []) {
      if (instance.status === "running" && instance.serverIp) {
        await pushToVm(instance.serverIp, gatewayToken, pushPath, payload.data);
      }
    }
  }
}
```

---

## 8. Service Registry

### 8.1 Design

The registry is a runtime singleton holding all registered adapters:

```typescript
// src/integrations/registry.ts

class IntegrationRegistry {
  private adapters = new Map<string, IntegrationAdapter>();

  register(adapter: IntegrationAdapter): void;
  get(id: string): IntegrationAdapter | undefined;
  getOrThrow(id: string): IntegrationAdapter;
  getAll(): IntegrationAdapter[];
  getByStrategy(strategy: AuthStrategy): IntegrationAdapter[];
  getVmCapable(): IntegrationAdapter[];
}

export const registry = new IntegrationRegistry();
```

### 8.2 Registration

Adapters self-register in an init module:

```typescript
// src/integrations/init.ts
import { registry } from "./registry";
import { googleAdapter } from "./adapters/google";
import { elevenLabsAdapter } from "./adapters/elevenlabs";
import { slackAdapter } from "./adapters/slack";

registry.register(googleAdapter);
registry.register(elevenLabsAdapter);
registry.register(slackAdapter);
```

### 8.3 Bridge with Existing Provider Registry

The existing `src/lib/integrations/providers.tsx` defines 73 `IntegrationProvider` entries (UI metadata: icon, color, capabilities, etc.). This is **not replaced** — it continues to serve the dashboard UI.

The `IntegrationAdapter` registry is the *runtime* registry. The two are connected by matching `id` fields:

- `IntegrationProvider.id` = `IntegrationAdapter.id` = `integrations.provider`

An integration can exist in the UI registry (`providers.tsx`) before it has a working adapter — this is how "Coming Soon" integrations work.

---

## 9. Migration Path

### Phase 1: Types Only (This Task)

- Create `src/integrations/types/` with all interface definitions
- No runtime code changes, no DB changes
- Existing Google and ElevenLabs continue working as-is

### Phase 2: Adapter Implementations

- Create concrete adapter classes for each integration
- Adapters wrap existing code from `src/lib/integrations/` — no rewriting
- Example: `GoogleAdapter.processOAuthTokens()` calls the existing callback logic

### Phase 3: Generic Route Handlers

- Create route handler factories that delegate to registered adapters
- Migrate one provider at a time to use the generic handlers
- Existing per-provider routes stay until fully migrated

### Phase 4: Provisioning Integration

- Refactor `hetzner.ts` to consume `VmSkillManifest` from adapters
- Replace hard-coded Google skill generation with `adapter.getVmSkillManifest()`
- Add manifest merging for multiple VM-capable integrations

---

## 10. How to Add a New Integration

### Step 1: Choose Your Base Class

```typescript
// OAuth integration
export class SlackAdapter extends OAuthAdapter<SlackMetadata> { ... }

// API key integration
export class DatadogAdapter extends ApiKeyAdapter<DatadogMetadata> { ... }
```

### Step 2: Implement Required Methods

**For OAuth (`OAuthAdapter`):**
- `getOAuthConfig()` — return your provider's OAuth endpoints, scopes, env var names
- `processOAuthTokens(tokens)` — extract access/refresh tokens, fetch user info, return metadata
- `validateCredentials(envelope)` — make a lightweight API call to verify stored tokens

**For API Key (`ApiKeyAdapter`):**
- `getApiKeyFields()` — describe the form fields the user fills in
- `validateApiKey(input)` — validate the key against the provider's API
- `validateCredentials(envelope)` — check if the stored key is still valid

### Step 3: Optional — Add VM Skill

If your integration should run on the agent VM:
- Implement `getVmSkillManifest(gatewayToken)` — return skill files, systemd service, Caddy route
- Implement `buildVmCredentialPayload(envelope)` — build the JSON payload for the credential receiver

### Step 4: Optional — Add Chat Tools

If your integration provides LLM tools for the fallback path:
- Implement `getChatTools()` — return OpenAI function-calling tool definitions
- Implement `executeChatTool(toolName, args, accessToken)` — execute tool calls

### Step 5: Register

Add your adapter to `src/integrations/init.ts`:

```typescript
import { slackAdapter } from "./adapters/slack";
registry.register(slackAdapter);
```

### Step 6: Add UI Metadata

If not already present, add an entry to `src/lib/integrations/providers.tsx` with `id` matching your adapter's `id`.

### Step 7: Add Environment Variables

Add `{PROVIDER}_CLIENT_ID` and `{PROVIDER}_CLIENT_SECRET` to `.env` and deployment configs.

---

## 11. Error Handling Guidelines

### Rate Limiting

Rate-limit handling is provider-specific and lives in the adapter implementation, not the framework core. Common patterns:

- **HubSpot**: `429 Too Many Requests` — standard retry-after header
- **Salesforce**: `403 Forbidden` with `REQUEST_LIMIT_EXCEEDED` error code
- **Slack**: `429` with `Retry-After` header
- **Google**: `429` with exponential backoff recommendation

Adapters should implement retry logic in their `executeChatTool()` and `validateCredentials()` methods.

### Token Expiry

The framework automatically handles token refresh via `refreshToken()`. Provider-specific considerations:

- **Salesforce**: does not include `expires_in` in token response — adapter must estimate (typically ~2 hours)
- **Salesforce**: rotates refresh tokens since Spring 2024 — return new `refreshToken` in `TokenRefreshResult`
- **HubSpot**: access tokens expire after 30 minutes
- **Slack**: tokens do not expire (no refresh needed)
- **Google**: access tokens expire after 1 hour

### Disconnection Cleanup

Adapters can implement `onDisconnect()` to perform cleanup:
- Revoke OAuth tokens at the provider
- Deregister webhooks
- Delete bot users
- Clean up VM-side credentials

---

## 12. Directory Structure (Future)

```
src/integrations/
  types/
    adapter.ts          ← IntegrationAdapter interface + base classes
    oauth.ts            ← OAuthConfig types
    credentials.ts      ← CredentialEnvelope, CredentialPayload
    vm-skill.ts         ← VmSkillManifest types
    index.ts            ← barrel export
  registry.ts           ← singleton IntegrationRegistry
  init.ts               ← adapter registration
  helpers/
    envelope.ts         ← CredentialEnvelope factory + decrypt helper
    route-factory.ts    ← generic OAuth + API-key route handler factories
    vm-provisioning.ts  ← generic VM skill merging for cloud-init
    credential-push.ts  ← generic credential push to running VMs
  adapters/
    google.ts           ← wraps existing src/lib/integrations/ code
    elevenlabs.ts       ← wraps existing ElevenLabs routes
    slack.ts            ← new
    hubspot.ts          ← new
    salesforce.ts       ← new
    ...
```
