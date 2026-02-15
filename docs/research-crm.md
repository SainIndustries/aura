# CRM Integration Research: HubSpot & Salesforce

> Phase 1 research for adding HubSpot and Salesforce CRM integrations to Aura.
> This document covers authentication, API endpoints, rate limits, webhooks, SDKs, credential storage, and how each service maps to existing Aura patterns.

---

## 1. Existing Aura Integration Patterns

Before diving into HubSpot/Salesforce specifics, here's how integrations currently work in Aura. All new CRM integrations should follow these established patterns.

### Database Schema (`src/lib/db/schema.ts:192-210`)

The `integrations` table stores all provider connections:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `userId` | UUID (FK → users) | Owner of the connection |
| `provider` | text | `"google"`, `"hubspot"`, `"salesforce"`, etc. |
| `accessToken` | text | AES-256-GCM encrypted |
| `refreshToken` | text | AES-256-GCM encrypted |
| `tokenExpiry` | timestamp (tz) | When access token expires |
| `scopes` | text[] | Array of granted scopes |
| `metadata` | JSONB | Provider-specific data (email, portalId, instanceUrl, etc.) |
| `connectedAt` | timestamp (tz) | When user connected |

Agent-level integration enablement is stored in `agents.integrations` JSONB field:
```json
{ "google": true, "hubspot": true, "salesforce": false }
```

### Token Encryption (`src/lib/integrations/encryption.ts`)

- Algorithm: AES-256-GCM
- Key derivation: `scryptSync` from `INTEGRATION_ENCRYPTION_KEY` env var
- Storage format: `iv:authTag:encrypted` (hex-encoded)
- Functions: `encryptToken(token)` / `decryptToken(encryptedToken)`
- **All tokens must be encrypted before DB insert and decrypted before use.**

### OAuth State / CSRF (`src/lib/integrations/oauth-state.ts`)

- State format: `nonce:userId:agentId:hmacSig`
- Embeds `userId` in state to avoid relying on auth cookies across redirects
- Optional `agentId` to auto-enable integration on a specific agent after OAuth
- HMAC-SHA256 signature for integrity, nonce stored in httpOnly cookie
- Functions: `generateState(userId, agentId?)` / `validateState(state)`

### Token Refresh (`src/lib/integrations/token-refresh.ts`)

- `getValidAccessToken(integrationId, provider)` — checks expiry, auto-refreshes if expired
- `refreshGoogleToken(integrationId)` — POSTs to Google's token endpoint with `grant_type=refresh_token`
- Currently only Google is implemented; **HubSpot and Salesforce need analogous `refreshHubSpotToken` and `refreshSalesforceToken` functions**
- Pattern: decrypt refresh token → POST to provider → encrypt new access token → update DB

### OAuth Route Pattern

**Initiation** (`GET /api/integrations/{provider}`):
1. Verify user authentication
2. Check provider env vars are configured
3. Generate CSRF state with `generateState(userId, agentId?)`
4. Redirect to provider's authorization URL with scopes

**Callback** (`GET /api/integrations/{provider}/callback`):
1. Validate `state` param with `validateState()`
2. Exchange authorization `code` for tokens
3. (Optional) Fetch account metadata from provider
4. Encrypt tokens and upsert `integrations` row
5. Return HTML that closes the OAuth popup window

### Provider Registry (`src/lib/integrations/providers.tsx`)

HubSpot and Salesforce are already registered:
- HubSpot: `id: "hubspot"`, `category: "crm"`, `color: "#FF7A59"`, `comingSoon: false`
- Salesforce: `id: "salesforce"`, `category: "crm"`, `color: "#00A1E0"`, `comingSoon: false`

### Credential Push to VMs (`src/lib/integrations/credential-push.ts`)

Currently Google-only. After OAuth, decrypted tokens are POSTed to all running agent VMs via `http://{serverIp}/internal/google-credentials`. CRM integrations will initially be proxied through the Aura API (no VM push needed), but the pattern exists if we want VM-native CRM skills later.

---

## 2. HubSpot Integration

### 2.1 Authentication

**OAuth 2.0 Flow (recommended for multi-user SaaS)**

| Detail | Value |
|--------|-------|
| Authorization URL | `https://app.hubspot.com/oauth/authorize` |
| Token endpoint | `POST https://api.hubapi.com/oauth/v3/token` |
| Token introspection | `POST https://api.hubapi.com/oauth/v3/introspect` |
| Access token lifetime | **30 minutes** |
| Refresh token lifetime | Long-lived (no expiry unless revoked) |
| Grant type for refresh | `refresh_token` |

**Token Exchange (code → tokens):**
```
POST https://api.hubapi.com/oauth/v3/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&redirect_uri={CALLBACK_URL}
&code={AUTH_CODE}
```

**Token Refresh:**
```
POST https://api.hubapi.com/oauth/v3/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&refresh_token={REFRESH_TOKEN}
```

> **Important (v3):** Parameters must be in the request body, not query params, to prevent sensitive data in logs.

**Required Scopes:**

| Scope | Purpose |
|-------|---------|
| `crm.objects.contacts.read` | Read contacts |
| `crm.objects.contacts.write` | Create/update contacts |
| `crm.objects.deals.read` | Read deals |
| `crm.objects.deals.write` | Create/update deals |
| `crm.objects.companies.read` | Read companies |
| `crm.objects.companies.write` | Create/update companies |
| `crm.objects.tasks.read` | Read tasks |
| `crm.objects.tasks.write` | Create/update tasks |
| `crm.objects.notes.read` | Read notes |
| `crm.objects.notes.write` | Create/update notes |
| `crm.associations.read` | Read object associations |
| `crm.associations.write` | Create/update associations |

**Alternative: Private App Tokens**
- Static tokens with no expiry
- Simpler but only for internal/single-account use
- Not suitable for Aura's multi-user model

### 2.2 Key API Endpoints

Base URL: `https://api.hubapi.com`

All CRM objects follow a consistent REST pattern:

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create | POST | `/crm/v3/objects/{objectType}` |
| Read one | GET | `/crm/v3/objects/{objectType}/{id}` |
| Read all | GET | `/crm/v3/objects/{objectType}` |
| Update | PATCH | `/crm/v3/objects/{objectType}/{id}` |
| Delete | DELETE | `/crm/v3/objects/{objectType}/{id}` |
| Search | POST | `/crm/v3/objects/{objectType}/search` |
| Batch create | POST | `/crm/v3/objects/{objectType}/batch/create` |
| Batch update | POST | `/crm/v3/objects/{objectType}/batch/update` |
| Batch delete | POST | `/crm/v3/objects/{objectType}/batch/archive` |

Where `{objectType}` = `contacts`, `deals`, `companies`, `tasks`, `notes`

**Associations:**

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Create | PUT | `/crm/v3/objects/{from}/{id}/associations/{to}/{toId}/{typeId}` |
| Batch create | POST | `/crm/v3/associations/{from}/{to}/batch/create` |
| Batch read | POST | `/crm/v3/associations/{from}/{to}/batch/read` |
| Delete | DELETE | `/crm/v3/objects/{from}/{id}/associations/{to}/{toId}/{typeId}` |
| Get types | GET | `/crm/v3/associations/{from}/{to}/types` |

Supported: Contacts <-> Companies, Deals, Tickets, Tasks, Notes

**Account Info (for metadata):**
```
GET https://api.hubapi.com/account-info/v3/details
```
Returns: `portalId`, `uiDomain`, `timeZone`, `currency`

### 2.3 Rate Limits

| Plan | Daily Limit | Burst Limit |
|------|-------------|-------------|
| Professional | 650,000 requests/day | 190 requests / 10 seconds |
| Enterprise | 1,000,000 requests/day | 190 requests / 10 seconds |

- Burst limit applies per app independently
- Daily limit resets at midnight (user's timezone)
- Rate limit exceeded: **HTTP 429** (Too Many Requests)
- Daily limits are shared across all apps in the same HubSpot account

**Handling strategy:**
- Implement exponential backoff on 429
- Use batch endpoints to reduce call count
- Cache frequently-accessed records

### 2.4 Webhook Support

- Requires a **public HubSpot app** (not private apps)
- Up to **1,000 webhook subscriptions** per app
- HTTPS endpoint required

**Available events:**
- Contact: created, deleted, property changes
- Company: created, deleted, property changes
- Deal: created, deleted, property changes
- Task/Ticket/Product: similar CRUD events

**Payload format (JSON):**
```json
{
  "eventId": "unique-id",
  "subscriptionId": "webhook-subscription-id",
  "timestamp": 1234567890,
  "eventType": "contact.creation",
  "objectId": "contact-123",
  "changeSource": "API",
  "propertyName": "email",
  "propertyValue": "user@example.com"
}
```

### 2.5 SDK

**Package:** `@hubspot/api-client` (official, by HubSpot)
**Version:** 13.x (latest 13.4.0)
**TypeScript:** Full support, types included

```typescript
import { Client } from "@hubspot/api-client";

const client = new Client({ accessToken: "..." });

// Create contact
const contact = await client.crm.contacts.basicApi.create({
  properties: { firstname: "John", lastname: "Doe", email: "john@example.com" }
});

// Search deals
const deals = await client.crm.deals.searchApi.doSearch({
  filterGroups: [{ filters: [{ propertyName: "dealstage", operator: "EQ", value: "closedwon" }] }],
  properties: ["dealname", "amount", "closedate"],
  limit: 10,
});
```

### 2.6 API Versioning

| Version | Status | Use for |
|---------|--------|---------|
| **v3** | Stable (recommended) | All CRM object CRUD, search, most operations |
| **v4** | Stable (newer) | Advanced associations with labels, improved batch ops |

Both versions can be used simultaneously. Use v3 for standard operations; v4 only if association labels are needed.

### 2.7 Credential Storage (Aura DB)

```typescript
// integrations table row
{
  provider: "hubspot",
  accessToken: encryptToken(tokens.access_token),
  refreshToken: encryptToken(tokens.refresh_token),
  tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
  scopes: ["crm.objects.contacts.read", "crm.objects.contacts.write", ...],
  metadata: {
    portalId: "12345678",
    uiDomain: "app.hubspot.com",
    timeZone: "US/Eastern",
    currency: "USD",
  }
}
```

**Environment variables needed:**
```
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
```

---

## 3. Salesforce Integration

### 3.1 Authentication

**OAuth 2.0 Web Server Flow (recommended for user-initiated auth)**

| Detail | Value |
|--------|-------|
| Authorization URL | `https://login.salesforce.com/services/oauth2/authorize` |
| Token endpoint | `POST https://login.salesforce.com/services/oauth2/token` |
| Sandbox auth URL | `https://test.salesforce.com/services/oauth2/authorize` |
| Access token lifetime | **~2 hours** (session timeout policy) |
| Refresh token lifetime | Indefinite (unless revoked) |
| Grant type for refresh | `refresh_token` |

**Token Exchange:**
```
POST https://login.salesforce.com/services/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id={CONSUMER_KEY}
&client_secret={CONSUMER_SECRET}
&redirect_uri={CALLBACK_URL}
&code={AUTH_CODE}
```

**Token Refresh:**
```
POST https://login.salesforce.com/services/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id={CONSUMER_KEY}
&client_secret={CONSUMER_SECRET}
&refresh_token={REFRESH_TOKEN}
```

> **Critical: Refresh Token Rotation (Spring 2024+):** Salesforce now issues a NEW refresh token with each refresh. The old refresh token is auto-revoked. The token refresh handler MUST update both `accessToken` AND `refreshToken` in the DB atomically.

**Token Response:**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "instance_url": "https://na30.salesforce.com",
  "id": "https://login.salesforce.com/id/orgId/userId",
  "token_type": "Bearer",
  "issued_at": "1234567890",
  "signature": "..."
}
```

> **Note:** Salesforce does NOT return `expires_in`. Token expiry must be estimated (~2 hours) or determined via introspection.

**Required Scopes:**

| Scope | Purpose |
|-------|---------|
| `api` | Access and manage data |
| `refresh_token` | Enable refresh token generation |
| `offline_access` | Allow indefinite refresh token use |

These three scopes provide full REST API access. Salesforce doesn't have granular per-object scopes like HubSpot.

**Alternative: JWT Bearer Flow**
- Server-to-server auth without user interaction
- Requires X.509 certificate and connected app
- Use case: automated background tasks (heartbeats, syncs)
- Could be useful for Aura's heartbeat/cron features

**Connected App Setup:**
1. Setup > Platform Tools > Apps > App Manager > New Connected App
2. Enable OAuth Settings
3. Enter callback URL: `{NEXT_PUBLIC_APP_URL}/api/integrations/salesforce/callback`
4. Select scopes
5. Note Consumer Key + Consumer Secret

### 3.2 Key API Endpoints

Base URL: `https://{instance_url}/services/data/v66.0`

> **Instance URLs are per-customer.** Each Salesforce org has a unique instance URL (e.g., `na30.salesforce.com`). This URL is returned in the OAuth token response and MUST be stored in integration metadata.

**Standard Object CRUD:**

| Object | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Contact | POST `.../sobjects/Contact` | GET `.../sobjects/Contact/{id}` | PATCH `.../sobjects/Contact/{id}` | DELETE `.../sobjects/Contact/{id}` |
| Lead | POST `.../sobjects/Lead` | GET `.../sobjects/Lead/{id}` | PATCH `.../sobjects/Lead/{id}` | DELETE `.../sobjects/Lead/{id}` |
| Opportunity | POST `.../sobjects/Opportunity` | GET `.../sobjects/Opportunity/{id}` | PATCH `.../sobjects/Opportunity/{id}` | DELETE `.../sobjects/Opportunity/{id}` |
| Account | POST `.../sobjects/Account` | GET `.../sobjects/Account/{id}` | PATCH `.../sobjects/Account/{id}` | DELETE `.../sobjects/Account/{id}` |
| Task | POST `.../sobjects/Task` | GET `.../sobjects/Task/{id}` | PATCH `.../sobjects/Task/{id}` | DELETE `.../sobjects/Task/{id}` |
| Note | POST `.../sobjects/Note` | GET `.../sobjects/Note/{id}` | PATCH `.../sobjects/Note/{id}` | DELETE `.../sobjects/Note/{id}` |

**Composite Requests (batch):**
```
POST /services/data/v66.0/composite
```
Execute up to 25 subrequests in a single API call. Reduces round trips and API consumption.

### 3.3 SOQL (Salesforce Object Query Language)

Salesforce uses SOQL for searching/filtering records (unlike HubSpot's search POST body).

```sql
-- Search contacts by email
SELECT Id, FirstName, LastName, Email FROM Contact WHERE Email LIKE '%@company.com%'

-- Deals closing this month
SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity
WHERE CloseDate = THIS_MONTH AND StageName != 'Closed Lost'

-- Contacts with their Account info (relationship query)
SELECT FirstName, LastName, Account.Name FROM Contact WHERE Account.Industry = 'Technology'

-- Aggregation
SELECT StageName, COUNT(Id), SUM(Amount) FROM Opportunity GROUP BY StageName
```

**SOQL via API:**
```
GET /services/data/v66.0/query?q=SELECT+Id,Name+FROM+Contact+LIMIT+10
```

**SOSL (full-text search across objects):**
```
GET /services/data/v66.0/search?q=FIND+{John}+IN+ALL+FIELDS+RETURNING+Contact,Lead
```

### 3.4 Rate Limits

| Limit Type | Value |
|------------|-------|
| Daily API requests | Base 100,000 + 1,000 per user license (rolling 24h) |
| Concurrent long-running requests | 25 (production), 5 (developer) |
| Max single request duration | 10 minutes |
| Bulk API batches | 15,000/day, 10,000 records/batch |

- Rate limit exceeded: **HTTP 403** with error code `REQUEST_LIMIT_EXCEEDED`
- **No per-endpoint rate limits** — limits are global across all endpoints
- Rolling 24-hour window (not calendar day)

**Handling strategy:**
- Check for 403 + `REQUEST_LIMIT_EXCEEDED` error code (NOT 429)
- Exponential backoff with jitter
- Use composite requests to reduce call count
- Cache SOQL query results where appropriate

### 3.5 Webhook Support

Salesforce does NOT have traditional HTTP webhooks. Three alternatives:

| Mechanism | Description | Best For |
|-----------|-------------|----------|
| **Platform Events** | Custom event definitions, published via code/flows | Custom integrations, bidirectional sync |
| **Change Data Capture** | Auto-publishes on record create/update/delete/undelete | Real-time record sync, audit trails |
| **Outbound Messages** | SOAP-based POST to external URL from flows | Guaranteed delivery, simple payloads |

All three use CometD (long-polling) for subscription, not HTTP callbacks.

**Recommendation for Aura:** Defer real-time Salesforce events to a later phase. For Phase 2, use polling or on-demand API calls. If real-time sync is needed later, Change Data Capture is the best fit.

### 3.6 SDK

**Package:** `jsforce` (community-maintained, industry standard)
**Version:** 3.x (latest 3.10.14)
**TypeScript:** Full support (source in TypeScript, types included)

```typescript
import jsforce from "jsforce";

const conn = new jsforce.Connection({
  instanceUrl: "https://na30.salesforce.com",
  accessToken: "...",
});

// Create contact
const result = await conn.sobject("Contact").create({
  FirstName: "John",
  LastName: "Doe",
  Email: "john@example.com",
});

// SOQL query
const contacts = await conn.query(
  "SELECT Id, FirstName, LastName, Email FROM Contact WHERE Email != null LIMIT 10"
);

// Update opportunity
await conn.sobject("Opportunity").update({
  Id: "006xx000001Sgth",
  StageName: "Closed Won",
  Amount: 50000,
});
```

> **Note:** jsforce's `login()` SOAP API is retiring Summer '27. Use OAuth 2.0 flows instead (which Aura already does).

**Alternative:** Direct HTTP via `fetch` — simpler, no dependency, works well with Aura's existing pattern.

### 3.7 API Versioning

| Release | Version | Date |
|---------|---------|------|
| Spring '26 | **v66.0** (current) | Feb 2026 |
| Winter '26 | v65.0 | Oct 2025 |
| Summer '25 | v64.0 | May 2025 |

- REST API preferred over SOAP for new integrations
- Multiple versions supported concurrently (3+ year deprecation cycle)
- Version specified in URL path: `/services/data/v66.0/...`

### 3.8 Credential Storage (Aura DB)

```typescript
// integrations table row
{
  provider: "salesforce",
  accessToken: encryptToken(tokens.access_token),
  refreshToken: encryptToken(tokens.refresh_token),
  tokenExpiry: new Date(Date.now() + 7200 * 1000), // estimated ~2h
  scopes: ["api", "refresh_token", "offline_access"],
  metadata: {
    instanceUrl: "https://na30.salesforce.com",  // CRITICAL: per-user
    orgId: "00Dxx0000001gER",
    userId: "005xx000001Svog",                    // Salesforce user ID
  }
}
```

**Environment variables needed:**
```
SALESFORCE_CLIENT_ID=     # Consumer Key from Connected App
SALESFORCE_CLIENT_SECRET= # Consumer Secret from Connected App
```

### 3.9 Instance URLs

| Endpoint | URL |
|----------|-----|
| Production login | `https://login.salesforce.com` |
| Sandbox login | `https://test.salesforce.com` |
| Custom domain | `https://{company}.my.salesforce.com` |
| API base (per-user) | `https://{instance}.salesforce.com` (from OAuth response) |

The `instance_url` from the OAuth token response is the API base for all subsequent calls. This MUST be stored in `metadata.instanceUrl`.

---

## 4. Comparative Analysis

| Dimension | HubSpot | Salesforce |
|-----------|---------|------------|
| **Auth flow** | Standard OAuth 2.0 | OAuth 2.0 (Web Server or JWT Bearer) |
| **Token endpoint** | `api.hubapi.com/oauth/v3/token` | `login.salesforce.com/services/oauth2/token` |
| **Access token TTL** | 30 minutes | ~2 hours |
| **Refresh token** | Long-lived, stable | Rotates on each refresh (Spring 2024+) |
| **Scopes** | Granular per-object | Coarse (`api`, `refresh_token`) |
| **API base URL** | Fixed: `api.hubapi.com` | Per-user: `{instance}.salesforce.com` |
| **CRUD pattern** | `/crm/v3/objects/{type}` | `/services/data/v66.0/sobjects/{type}` |
| **Search** | POST body with filter groups | SOQL query language |
| **Rate limit error** | HTTP 429 | HTTP 403 + `REQUEST_LIMIT_EXCEEDED` |
| **Daily limit** | 650K–1M | 100K + 1K/license |
| **Burst limit** | 190 / 10 sec | N/A (concurrent limit: 25) |
| **Webhooks** | Standard HTTP POST callbacks | CometD (Platform Events, CDC) |
| **SDK** | `@hubspot/api-client` (official) | `jsforce` (community) |
| **TypeScript** | Full support | Full support |
| **API version** | v3 (stable) / v4 (associations) | v66.0 (Spring '26) |

---

## 5. Architectural Recommendations for Implementation

### 5.1 What Fits Existing Patterns

Both HubSpot and Salesforce fit Aura's existing OAuth integration pattern well:
- Standard OAuth 2.0 authorization code flow
- Tokens stored encrypted in `integrations` table
- Provider-specific data in `metadata` JSONB
- Token refresh via `token-refresh.ts` pattern
- Already registered in `providers.tsx`

### 5.2 Key Implementation Considerations

1. **Salesforce instance URL:** Must be stored in `metadata.instanceUrl` and used as API base for all requests. HubSpot uses a fixed base URL.

2. **Salesforce refresh token rotation:** The `refreshSalesforceToken()` function must update BOTH `accessToken` and `refreshToken` in a single DB write (the old refresh token becomes invalid).

3. **Rate limit error detection:** Must be provider-specific:
   - HubSpot: check for HTTP 429
   - Salesforce: check for HTTP 403 + `REQUEST_LIMIT_EXCEEDED` error code

4. **Token expiry estimation (Salesforce):** Salesforce doesn't return `expires_in`. Use a conservative estimate of ~2 hours, or implement token introspection.

5. **Search abstraction:** HubSpot uses POST with filter groups; Salesforce uses SOQL strings. A unified search interface will need to translate between these.

6. **Webhooks:** HubSpot webhooks are straightforward HTTP. Salesforce requires CometD long-polling, which is significantly more complex. Recommend deferring Salesforce real-time events.

### 5.3 Recommended OAuth Scopes

**HubSpot:**
```typescript
const HUBSPOT_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.tasks.read",
  "crm.objects.tasks.write",
  "crm.objects.notes.read",
  "crm.objects.notes.write",
  "crm.associations.read",
  "crm.associations.write",
];
```

**Salesforce:**
```typescript
const SALESFORCE_SCOPES = ["api", "refresh_token", "offline_access"];
```

### 5.4 Environment Variables

```bash
# HubSpot OAuth
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=

# Salesforce Connected App
SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=

# Existing (shared)
INTEGRATION_ENCRYPTION_KEY=   # Already configured for Google
NEXT_PUBLIC_APP_URL=           # Used for callback URLs
```

### 5.5 New Files Needed (Phase 2)

```
src/app/api/integrations/hubspot/route.ts          # OAuth initiation
src/app/api/integrations/hubspot/callback/route.ts  # OAuth callback
src/app/api/integrations/salesforce/route.ts        # OAuth initiation
src/app/api/integrations/salesforce/callback/route.ts # OAuth callback
src/lib/integrations/token-refresh.ts               # Add refreshHubSpotToken, refreshSalesforceToken
```

### 5.6 SDK Decision

| Approach | Pros | Cons |
|----------|------|------|
| **Use SDKs** (`@hubspot/api-client`, `jsforce`) | Type safety, handles pagination, built-in retry | Extra dependencies, SDK quirks |
| **Direct HTTP** (`fetch`) | Consistent with Google pattern, no extra deps | Manual pagination, less type safety |

**Recommendation:** Start with direct HTTP (`fetch`) for consistency with the Google integration pattern. Add SDKs later if complexity warrants it.

---

## Sources

- [HubSpot OAuth v3 Authentication](https://developers.hubspot.com/docs/api-reference/auth-oauth-v3/guide)
- [HubSpot CRM API](https://developers.hubspot.com/docs/api-reference/crm-contacts-v3/guide)
- [HubSpot API Usage Guidelines](https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines)
- [HubSpot Webhooks API](https://developers.hubspot.com/docs/api-reference/webhooks-webhooks-v3/guide)
- [@hubspot/api-client npm](https://www.npmjs.com/package/@hubspot/api-client)
- [Salesforce OAuth 2.0 JWT Bearer Flow](https://help.salesforce.com/s/articleView?id=xcloud.remoteaccess_oauth_jwt_flow.htm)
- [Salesforce REST API Developer Guide v66.0](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_list.htm)
- [Salesforce API Limits](https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm)
- [Salesforce Platform Events & CDC](https://developer.salesforce.com/docs/atlas.en-us.change_data_capture.meta/change_data_capture/)
- [jsforce npm](https://www.npmjs.com/package/jsforce)
- [SOQL Reference](https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_soql_select.htm)
