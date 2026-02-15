# Communications Integration Research: Slack, Twilio & Outlook

> Phase 1 research for adding Slack, Twilio, and Outlook communications integrations to Aura.
> This document covers authentication, API endpoints, rate limits, webhooks, SDKs, credential storage, and how each service maps to the unified integration framework.

---

## 1. Existing Aura Integration Patterns

New integrations plug into the unified adapter framework (`src/integrations/types/`). Each integration extends either `OAuthAdapter` or `ApiKeyAdapter` from `adapter.ts`.

### Database Schema (`src/lib/db/schema.ts`)

The `integrations` table stores all provider connections:

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID (PK) | Auto-generated |
| `userId` | UUID (FK → users) | Owner of the connection |
| `provider` | text | `"google"`, `"slack"`, `"twilio"`, `"outlook"`, etc. |
| `accessToken` | text | AES-256-GCM encrypted |
| `refreshToken` | text | AES-256-GCM encrypted (OAuth only) |
| `tokenExpiry` | timestamp (tz) | When access token expires (`null` for API keys) |
| `scopes` | text[] | Array of granted scopes |
| `metadata` | JSONB | Provider-specific data (email, team_id, account_sid, etc.) |
| `connectedAt` | timestamp (tz) | When user connected |

### Framework Types (`src/integrations/types/`)

| File | Purpose |
|------|---------|
| `adapter.ts` | `IntegrationAdapter` interface, `OAuthAdapter` / `ApiKeyAdapter` base classes |
| `oauth.ts` | `OAuthConfig` type — authorization URL, token URL, scopes, delimiter, env var names |
| `credentials.ts` | `CredentialEnvelope` (DB row wrapper), `CredentialPayload` (VM push) |
| `vm-skill.ts` | `VmSkillManifest` — cloud-init files, systemd services, Caddy routes |

### Auth Strategy Discriminator

The framework uses `AuthStrategy = "oauth2" | "api_key" | "webhook"`:
- **Slack** → `oauth2` (OAuth 2.0 with optional token rotation)
- **Twilio** → `api_key` (Account SID + Auth Token, pasted into dashboard)
- **Outlook** → `oauth2` (Microsoft identity platform, mirrors Google pattern)

### Credential Lifecycle (Reference)

```
OAuth: User → consent screen → callback → encrypt tokens → DB → push to VMs
API Key: User → paste key in UI → validate → encrypt → DB → push to VMs
```

Existing implementations: Google (OAuth), ElevenLabs (API key).

---

## 2. Slack

### 2.1 Authentication

**Strategy:** `oauth2` — OAuth 2.0 v2 flow with bot and user tokens.

**OAuth Flow:**

1. Redirect to `https://slack.com/oauth/v2/authorize` with `client_id`, `scope` (bot scopes), `user_scope` (user scopes), `redirect_uri`
2. User approves → Slack redirects back with temporary `code` (expires in 10 min)
3. Exchange code at `POST https://slack.com/api/oauth.v2.access` with `client_id`, `client_secret`, `code`

**Token Response:**
```json
{
  "ok": true,
  "access_token": "xoxb-...",        // Bot token
  "token_type": "bot",
  "scope": "chat:write,channels:read,...",
  "bot_user_id": "U0KRQLJ9H",
  "app_id": "A0KRD7HC3",
  "team": { "name": "Workspace", "id": "T9TK3CUKW" },
  "authed_user": {
    "id": "U1234",
    "scope": "search:read",
    "access_token": "xoxp-...",       // User token
    "token_type": "user"
  }
}
```

**Token Types:**

| Token | Prefix | Purpose | Expiration |
|-------|--------|---------|------------|
| Bot token | `xoxb-` | All bot API calls | Never (unless rotation enabled) |
| User token | `xoxp-` | User-scoped calls (search) | Never (unless rotation enabled) |
| App-level token | `xapp-` | Socket Mode WebSocket | Never |
| Expiring token | `xoxe-` | Rotated access token | 12 hours (43,200 sec) |

**Token Rotation** (opt-in): When enabled, tokens refresh via `POST https://slack.com/api/oauth.v2.access` with `grant_type=refresh_token`. Returns new `xoxe-` access token + new refresh token. Old refresh token is revoked.

**OAuthConfig mapping:**
```typescript
{
  authorizationUrl: "https://slack.com/oauth/v2/authorize",
  tokenUrl: "https://slack.com/api/oauth.v2.access",
  clientIdEnvVar: "SLACK_CLIENT_ID",
  clientSecretEnvVar: "SLACK_CLIENT_SECRET",
  scopes: ["app_mentions:read", "channels:read", "channels:history", "groups:read",
           "groups:history", "im:read", "im:history", "chat:write",
           "chat:write.public", "users:read", "users:read.email",
           "reactions:read", "reactions:write", "files:read", "files:write"],
  scopeDelimiter: ",",
  extraAuthParams: { user_scope: "search:read" },
}
```

### 2.2 Required Scopes

**Bot scopes** (via `scope` param):

| Scope | Purpose |
|-------|---------|
| `app_mentions:read` | Receive @mention events |
| `channels:read` | List public channels |
| `channels:history` | Read public channel messages |
| `groups:read` | List private channels (bot is member of) |
| `groups:history` | Read private channel messages |
| `im:read` | List DM conversations |
| `im:history` | Read DM messages |
| `chat:write` | Send messages (channels bot is in) |
| `chat:write.public` | Send messages to any public channel |
| `users:read` | Read user profiles |
| `users:read.email` | Read user emails |
| `reactions:read` | Read emoji reactions |
| `reactions:write` | Add emoji reactions |
| `files:read` | Read files |
| `files:write` | Upload files |

**User scopes** (via `user_scope` param):

| Scope | Purpose |
|-------|---------|
| `search:read` | Search messages (user token ONLY — `search.messages` does not support bot tokens) |

### 2.3 Key API Endpoints

Base URL: `https://slack.com/api/`
Auth: `Authorization: Bearer xoxb-...` header.

#### chat.postMessage — Send Messages

| Property | Value |
|----------|-------|
| Method | `POST` |
| Rate Limit | Special: ~1 msg/sec/channel, several hundred/min workspace-wide |
| Scope | `chat:write` (+ `chat:write.public` for any public channel) |

Key params: `channel` (ID), `text` (max 4K chars), `blocks` (Block Kit), `thread_ts` (threading).

#### conversations.history — Read Messages

| Property | Value |
|----------|-------|
| Method | `GET` |
| Rate Limit | Tier 3 (50+ req/min) for custom apps |
| Scope | `channels:history`, `groups:history`, `im:history`, `mpim:history` |

Key params: `channel`, `limit` (default/max 1000), `cursor`, `oldest`, `latest`.

#### conversations.list — List Channels

| Property | Value |
|----------|-------|
| Method | `GET` |
| Rate Limit | Tier 2 (20+ req/min) |
| Scope | `channels:read`, `groups:read`, `im:read`, `mpim:read` |

Key params: `types` (public_channel, private_channel, mpim, im), `exclude_archived`, `limit`, `cursor`.

#### search.messages — Search Messages

| Property | Value |
|----------|-------|
| Method | `GET` |
| Rate Limit | Tier 2 (20+ req/min) |
| Scope | `search:read` |
| **Token** | **User token ONLY (`xoxp-`)** |

Key params: `query` (supports `in:channel`, `from:@user`), `sort`, `count` (max 100), `cursor`.

#### users.info — User Profile

| Property | Value |
|----------|-------|
| Method | `GET` |
| Rate Limit | Tier 4 (100+ req/min) |
| Scope | `users:read` (+ `users:read.email` for email) |

#### File Upload (New 3-step flow, old `files.upload` deprecated March 2025)

1. `POST files.getUploadURLExternal` → get upload URL + file ID
2. Upload file data to returned URL
3. `POST files.completeUploadExternal` → link file to channel(s)

#### reactions.add — React to Messages

| Property | Value |
|----------|-------|
| Method | `POST` |
| Rate Limit | Tier 3 (50+ req/min) |
| Scope | `reactions:write` |

Params: `channel`, `name` (emoji without colons), `timestamp`.

### 2.4 Rate Limits

**Tier System** (per method, per workspace, per app):

| Tier | Min Requests/Min | Key Methods |
|------|------------------|-------------|
| Tier 1 | 1+ | Infrequent methods |
| Tier 2 | 20+ | `conversations.list`, `search.messages` |
| Tier 3 | 50+ | `conversations.history`, `reactions.add` |
| Tier 4 | 100+ | `users.info` |
| Special | Varies | `chat.postMessage` (~1/sec/channel) |

When rate-limited: `HTTP 429` with `Retry-After: <seconds>` header. No `X-RateLimit-*` headers.

Events API: 30,000 event deliveries per hour per workspace.

### 2.5 Webhook / Events API

**Two delivery modes:**

| Mode | Setup | Marketplace Allowed | Best For |
|------|-------|---------------------|----------|
| **HTTP Events API** | Public HTTPS endpoint | Yes | Production |
| **Socket Mode** | WebSocket via `xapp-` token | No | Development / internal |

**HTTP Events API setup:**
1. Set Request URL (HTTPS) in app settings
2. Handle challenge verification: respond to `{"type":"url_verification","challenge":"xyz"}` with `{"challenge":"xyz"}`
3. Subscribe to events
4. Respond to each event with HTTP 2xx within **3 seconds**

**Request signing verification:**
```
1. Check X-Slack-Request-Timestamp is within 5 minutes
2. base_string = "v0:" + timestamp + ":" + raw_body
3. sig = "v0=" + HMAC_SHA256(signing_secret, base_string)
4. Compare sig with X-Slack-Signature (timing-safe)
```

**Key event types for an AI agent:**

| Event | Description | Scope |
|-------|-------------|-------|
| `message.channels` | Messages in public channels | `channels:history` |
| `message.groups` | Messages in private channels | `groups:history` |
| `message.im` | Direct messages | `im:history` |
| `app_mention` | Bot @mentioned | `app_mentions:read` |
| `reaction_added` | Emoji reaction added | `reactions:read` |

### 2.6 SDK

| Package | Version | Purpose |
|---------|---------|---------|
| `@slack/bolt` | 4.6.0 | Full framework (events, commands, OAuth) |
| `@slack/web-api` | 7.14.0 | Low-level API client (bundled in bolt) |

### 2.7 Credential Storage

Store in `integrations` table:

| Field | DB Column | Value |
|-------|-----------|-------|
| Bot token (`xoxb-`) | `accessToken` (encrypted) | Primary API token |
| User token (`xoxp-`) | `metadata.userToken` (encrypted separately) | For `search.messages` |
| Refresh token | `refreshToken` (encrypted) | Only if rotation enabled |
| Token expiry | `tokenExpiry` | `null` if no rotation; 12h if rotation enabled |
| Signing secret | env var `SLACK_SIGNING_SECRET` | **Not** per-user — app-wide |
| Team ID | `metadata.teamId` | Workspace identifier |
| Bot user ID | `metadata.botUserId` | Identify bot in messages |
| App ID | `metadata.appId` | App identifier |

### 2.8 Framework Mapping

| Adapter Method | Slack Implementation |
|---------------|---------------------|
| `authStrategy` | `"oauth2"` |
| `getOAuthConfig()` | See 2.1 OAuthConfig mapping above |
| `processOAuthTokens()` | Extract bot token + user token from dual-token response; store user token in `metadata` |
| `validateCredentials()` | `GET https://slack.com/api/auth.test` with bot token |
| `refreshToken()` | If rotation enabled: `POST oauth.v2.access` with `grant_type=refresh_token` |
| `getVmSkillManifest()` | CLI skill wrapping `@slack/web-api` for send/read/search |
| `getChatTools()` | `send_slack_message`, `list_slack_channels`, `read_slack_messages`, `search_slack_messages` |

---

## 3. Twilio

### 3.1 Authentication

**Strategy:** `api_key` — No OAuth. Users paste Account SID + Auth Token.

**Authentication method:** HTTP Basic Auth
```
Authorization: Basic base64(AccountSid:AuthToken)
// OR
Authorization: Basic base64(ApiKeySid:ApiKeySecret)
```

**Credential types:**

| Credential | Format | Purpose |
|------------|--------|---------|
| Account SID | `AC` + 32 hex chars (34 total) | Primary account identifier |
| Auth Token | 32 hex chars | Master account password |
| API Key SID | `SK` + 32 hex chars (34 total) | Production-preferred credential |
| API Key Secret | 32 hex chars | Shown once at creation |

API keys are preferred for production (individually revocable without rotating master Auth Token). Account SID is still required as a URL path parameter.

**ApiKeyFields mapping:**
```typescript
[
  { name: "primaryKey", label: "Account SID", placeholder: "AC...", required: true, secret: false },
  { name: "secondaryKey", label: "Auth Token", placeholder: "32-character token", required: true, secret: true },
]
```

### 3.2 Key API Endpoints

Base URL: `https://api.twilio.com/2010-04-01/Accounts/{AccountSid}`

#### Send SMS / MMS

```
POST /Messages.json
```

| Param | Required | Description |
|-------|----------|-------------|
| `To` | Yes | E.164 format (`+16175551212`) |
| `From` | Yes | Your Twilio number |
| `Body` | Yes (or MediaUrl) | Up to 1600 chars |
| `MediaUrl` | No | MMS media URL |
| `StatusCallback` | No | Delivery status webhook URL |

Response: `sid` (SM/MM prefix), `status`, `date_created`, `price`, `num_segments`.

#### Receive SMS (Webhook)

Twilio sends HTTP POST to configured webhook URL with params: `MessageSid`, `From`, `To`, `Body`, `NumMedia`, `MediaUrl0...`. Respond with TwiML:
```xml
<Response><Message>Reply text</Message></Response>
```

#### Make Voice Calls

```
POST /Calls.json
```

| Param | Required | Description |
|-------|----------|-------------|
| `To` | Yes | E.164, SIP, or Client ID |
| `From` | Yes | Your Twilio number |
| `Url` | Yes (or `Twiml`) | URL returning TwiML |
| `Twiml` | Yes (or `Url`) | Inline TwiML XML |
| `StatusCallback` | No | Call status webhook URL |

#### Receive Voice Calls (TwiML Webhook)

Twilio sends HTTP request with `CallSid`, `From`, `To`, `CallStatus`. Respond with TwiML:
```xml
<Response>
  <Say voice="Polly.Amy">Hello, this is your AI agent.</Say>
  <Gather input="speech" action="/handle-input" timeout="5">
    <Say>How can I help you?</Say>
  </Gather>
</Response>
```

Key TwiML verbs: `<Say>`, `<Play>`, `<Gather>`, `<Dial>`, `<Record>`, `<Redirect>`, `<Pause>`, `<Hangup>`.

#### Send WhatsApp

Same Messages endpoint with `whatsapp:` prefix on phone numbers:
```
To=whatsapp:+15552229999
From=whatsapp:+15554449999
```

#### Get Message History

```
GET /Messages.json
```

Filter params: `To`, `From`, `DateSent`, `DateSent<`, `DateSent>`. Paginated JSON response.

#### Phone Number Management

| Action | Endpoint |
|--------|----------|
| Search available | `GET /AvailablePhoneNumbers/{CC}/Local.json` |
| Purchase | `POST /IncomingPhoneNumbers.json` |
| Configure webhooks | `POST /IncomingPhoneNumbers/{PN_SID}.json` |
| List owned | `GET /IncomingPhoneNumbers.json` |
| Release | `DELETE /IncomingPhoneNumbers/{PN_SID}.json` |

### 3.3 Rate Limits

**SMS Throughput (per number):**

| Number Type | SMS MPS | Notes |
|-------------|---------|-------|
| Long Code (10DLC) | Depends on A2P registration | Requires A2P 10DLC registration for US |
| Toll-Free | 3 MPS (default), up to 25+ MPS | Can request upgrade |
| Short Code | 100 MPS | Most expensive, highest throughput |

**A2P 10DLC Throughput by Trust Score:**

| Trust Score | Approx MPS | Daily Cap |
|-------------|------------|-----------|
| Low (1-49) | ~12 MPS total | 2K-10K/day |
| Medium (50-74) | ~120 MPS total | 50K-100K/day |
| High (75-100) | ~225 MPS total | 200K+/day |

**Voice:** 1 outbound call per second per account (default). Calls exceeding CPS are queued, not rejected.

**API Concurrency:** Account-specific concurrent request limit. Exceeded = `HTTP 429` (error code `20429`). Monitor via `Twilio-Concurrent-Requests` response header.

### 3.4 Webhook Support

**Setup:** Configure webhook URL on Twilio phone number (via Console or API). Twilio sends HTTP POST on incoming SMS/call.

**Signature Validation (`X-Twilio-Signature`):**

Algorithm (form-encoded requests):
1. Take full webhook URL
2. Sort all POST params alphabetically by key
3. Append each key-value pair to the URL string
4. Compute HMAC-SHA1 using Auth Token as secret
5. Base64-encode the hash
6. Compare to `X-Twilio-Signature` header

```javascript
const twilio = require('twilio');
const isValid = twilio.validateRequest(authToken, signature, url, params);
```

**TwiML responses:** XML subset wrapped in `<Response>`. Use SDK's `twiml.MessagingResponse()` or `twiml.VoiceResponse()` to generate programmatically.

### 3.5 SDK

| Package | Version | Features |
|---------|---------|----------|
| `twilio` | 5.11.2 | Full API client, TwiML generation, webhook validation, TypeScript types |

```javascript
const client = twilio(accountSid, authToken);
await client.messages.create({ to: '+15551234567', from: '+15559876543', body: 'Hello!' });
```

### 3.6 Credential Storage

Store in `integrations` table:

| Field | DB Column | Value |
|-------|-----------|-------|
| Account SID | `metadata.accountSid` | Always required (not secret) |
| Auth Token | `accessToken` (encrypted) | Secret — used for API calls + webhook validation |
| Phone number(s) | `metadata.phoneNumbers` | Array of E.164 numbers assigned to agent |
| Token expiry | `tokenExpiry` | `null` (never expires) |
| Refresh token | `refreshToken` | `null` (no refresh needed) |

### 3.7 Pricing (Pay-as-you-go)

| Service | Cost |
|---------|------|
| US Local Number | ~$1.15/month |
| Outbound SMS | ~$0.011-$0.014/segment |
| Inbound SMS | ~$0.011-$0.014/segment |
| Outbound voice | $0.014/min |
| Inbound voice (local) | $0.0085/min |
| WhatsApp | $0.005/msg + Meta fees |

### 3.8 Framework Mapping

| Adapter Method | Twilio Implementation |
|---------------|----------------------|
| `authStrategy` | `"api_key"` |
| `getApiKeyFields()` | Account SID + Auth Token fields (see 3.1) |
| `validateApiKey()` | `GET /Accounts/{SID}.json` — verify credentials work |
| `validateCredentials()` | Same as `validateApiKey` |
| `refreshToken()` | Returns `null` (no refresh needed — inherited from `ApiKeyAdapter`) |
| `getVmSkillManifest()` | CLI skill wrapping `twilio` SDK for send/receive SMS, call management |
| `getChatTools()` | `send_sms`, `send_whatsapp`, `list_messages`, `make_call` |

---

## 4. Outlook (Microsoft Graph)

### 4.1 Authentication

**Strategy:** `oauth2` — OAuth 2.0 via Microsoft identity platform v2.0. Very similar to Google.

**App Registration:** Required in [Microsoft Entra admin center](https://entra.microsoft.com). Produces:

| Credential | Description |
|------------|-------------|
| Application (client) ID | GUID assigned upon registration |
| Client Secret | Generated key (copy immediately — not retrievable later) |
| Directory (tenant) ID | Azure AD tenant; use `common` for multi-tenant |

**OAuth Flow:**

1. Redirect to `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` with `client_id`, `response_type=code`, `redirect_uri`, `scope`, `state`
2. User approves → Microsoft redirects with `code`
3. Exchange code at `POST https://login.microsoftonline.com/common/oauth2/v2.0/token` with `client_id`, `client_secret`, `code`, `redirect_uri`, `grant_type=authorization_code`

**Token Response:**
```json
{
  "token_type": "Bearer",
  "scope": "Mail.Read Mail.Send Calendars.ReadWrite Contacts.Read",
  "expires_in": 3736,
  "access_token": "eyJ0eXAi...",
  "refresh_token": "AwABAAAA..."
}
```

**Token Lifetimes:**

| Token | Lifetime | Notes |
|-------|----------|-------|
| Access token | 60-90 min (~75 min avg) | Non-configurable for most tenants |
| Refresh token | 90 days (rolling) | Stays valid as long as used within 90 days |
| Authorization code | ~10 min | One-time use |

**Refresh:** `POST https://login.microsoftonline.com/common/oauth2/v2.0/token` with `grant_type=refresh_token`. Must include `offline_access` in original scope request to receive refresh tokens.

**Refresh token revocation triggers:** Password change, self-service password reset, admin reset, explicit revocation.

**OAuthConfig mapping:**
```typescript
{
  authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  userInfoUrl: "https://graph.microsoft.com/v1.0/me",
  clientIdEnvVar: "MICROSOFT_CLIENT_ID",
  clientSecretEnvVar: "MICROSOFT_CLIENT_SECRET",
  scopes: ["offline_access", "User.Read", "Mail.Read", "Mail.Send",
           "Calendars.ReadWrite", "Contacts.Read"],
  scopeDelimiter: " ",
  extraAuthParams: { response_mode: "query" },
}
```

### 4.2 Required Scopes

**Delegated permissions (no admin consent needed):**

| Scope | Purpose |
|-------|---------|
| `offline_access` | Receive refresh tokens |
| `User.Read` | Read signed-in user's profile |
| `Mail.Read` | Read user mail |
| `Mail.Send` | Send mail as user |
| `Calendars.Read` | Read user calendars |
| `Calendars.ReadWrite` | Full calendar access |
| `Contacts.Read` | Read user contacts |

### 4.3 Key API Endpoints

Base URL: `https://graph.microsoft.com/v1.0`
Auth: `Authorization: Bearer {access_token}` header.

#### Send Email

```
POST /me/sendMail
Content-Type: application/json

{
  "message": {
    "subject": "Meeting tomorrow",
    "body": { "contentType": "HTML", "content": "<p>Let's meet at 2pm.</p>" },
    "toRecipients": [{ "emailAddress": { "address": "user@example.com" } }]
  },
  "saveToSentItems": true
}
```
Permission: `Mail.Send`. Response: `202 Accepted` (no body).

#### List Messages

```
GET /me/messages?$top=25&$select=subject,from,receivedDateTime,isRead&$orderby=receivedDateTime desc
```
Permission: `Mail.Read`. Supports OData: `$top` (max 1000), `$skip`, `$select`, `$filter`, `$orderby`.

#### Read a Message

```
GET /me/messages/{message-id}?$select=subject,body,from,toRecipients,receivedDateTime
```

#### Search Messages

```
GET /me/messages?$search="subject:quarterly report"
```
Uses KQL syntax. Searchable: `from`, `to`, `cc`, `subject`, `body`, `hasAttachments`. Up to 1,000 results.

#### List Calendar Events (CalendarView)

```
GET /me/calendarView?startDateTime=2026-02-15T00:00:00Z&endDateTime=2026-02-22T00:00:00Z
```
Permission: `Calendars.Read`. Both `startDateTime` and `endDateTime` are **required**. Expands recurring events into individual instances.

#### Create Calendar Event

```
POST /me/events
Content-Type: application/json

{
  "subject": "Team standup",
  "body": { "contentType": "HTML", "content": "Weekly sync" },
  "start": { "dateTime": "2026-02-20T09:00:00", "timeZone": "America/New_York" },
  "end": { "dateTime": "2026-02-20T09:30:00", "timeZone": "America/New_York" },
  "attendees": [{ "emailAddress": { "address": "user@example.com" }, "type": "required" }]
}
```
Permission: `Calendars.ReadWrite`. Response: `201 Created` with event object.

#### List Contacts

```
GET /me/contacts?$top=50&$select=displayName,emailAddresses,mobilePhone
```
Permission: `Contacts.Read`. Supports `$filter`, `$search`, `$orderby`.

### 4.4 Rate Limits

**Per-app + per-mailbox:**

| Limit | Value |
|-------|-------|
| Requests | 10,000 per 10-minute window |
| Concurrent requests | 4 per mailbox |
| Upload size | 150 MB per 5-minute window |

**Global app-level:** 130,000 requests per 10 seconds across all tenants.

**Exchange Online sending:** 10,000 recipients per 24-hour period per mailbox.

When throttled: `HTTP 429` with `Retry-After: <seconds>` header and `{ "error": { "code": "TooManyRequests" } }`.

**Batching:** Up to 20 requests in `POST /$batch`. Each evaluated individually against throttling.

### 4.5 Webhook Support (Graph Subscriptions)

**Create subscription:**
```
POST https://graph.microsoft.com/v1.0/subscriptions
{
  "changeType": "created,updated",
  "notificationUrl": "https://your-app.com/api/webhooks/outlook",
  "resource": "me/messages",
  "expirationDateTime": "2026-02-22T11:00:00Z",
  "clientState": "secretValue"
}
```

**Supported resources:** `me/messages`, `me/events`, `me/contacts`, `me/mailFolders('Inbox')/messages`.

**Maximum subscription lifetime:** 7 days (10,080 min) for messages/events/contacts.

**Notification URL requirements:**
- Must be HTTPS with TLS 1.2+
- Must handle validation: Microsoft sends POST with `validationToken` query param → respond with token as plain text within 10 seconds

**Subscription renewal:** `PATCH /subscriptions/{id}` with new `expirationDateTime` before expiry.

**Lifecycle notifications** (optional): Set `lifecycleNotificationUrl` to receive `subscriptionRemoved`, `reauthorizationRequired`, `missed` events.

### 4.6 SDK

| Package | Version | Purpose |
|---------|---------|---------|
| `@azure/msal-node` | 3.8.7 | OAuth token management (recommended) |
| `@microsoft/microsoft-graph-client` | 3.0.7 | API client (stable but not actively updated) |

**Recommendation:** Use `@azure/msal-node` for auth. Use direct `fetch` for Graph API calls (matches existing Aura pattern for Google). The new `@microsoft/msgraph-sdk` is still in preview — not recommended for production.

### 4.7 Credential Storage

Store in `integrations` table:

| Field | DB Column | Value |
|-------|-----------|-------|
| Access token | `accessToken` (encrypted) | ~75 min lifetime |
| Refresh token | `refreshToken` (encrypted) | 90-day rolling window |
| Token expiry | `tokenExpiry` | From `expires_in` |
| Scopes | `scopes` | `["offline_access", "User.Read", "Mail.Read", ...]` |
| Email | `metadata.email` | From `/me` profile |
| Display name | `metadata.displayName` | From `/me` profile |

**Environment variables:**
```
MICROSOFT_CLIENT_ID=<app-id-guid>
MICROSOFT_CLIENT_SECRET=<client-secret>
MICROSOFT_TENANT_ID=common
```

### 4.8 Framework Mapping

| Adapter Method | Outlook Implementation |
|---------------|----------------------|
| `authStrategy` | `"oauth2"` |
| `getOAuthConfig()` | See 4.1 OAuthConfig mapping above |
| `processOAuthTokens()` | Extract tokens; fetch `/me` for email + display name → store in metadata |
| `validateCredentials()` | `GET https://graph.microsoft.com/v1.0/me` with Bearer token |
| `refreshToken()` | `POST token endpoint` with `grant_type=refresh_token` |
| `getVmSkillManifest()` | CLI skill using `fetch` for Graph API (send mail, list events, etc.) |
| `getChatTools()` | `send_outlook_email`, `list_outlook_messages`, `search_outlook_messages`, `list_outlook_events`, `create_outlook_event`, `list_outlook_contacts` |

---

## 5. Cross-Service Comparison

| Aspect | Slack | Twilio | Outlook |
|--------|-------|--------|---------|
| **Auth type** | OAuth 2.0 | API key (Basic Auth) | OAuth 2.0 |
| **Adapter base class** | `OAuthAdapter` | `ApiKeyAdapter` | `OAuthAdapter` |
| **Token refresh** | Optional (12h if rotation on) | None needed | Required (~75 min expiry) |
| **Webhook model** | Events API or Socket Mode | HTTP POST + TwiML response | Graph subscriptions (7-day max) |
| **Webhook validation** | HMAC-SHA256 (signing secret) | HMAC-SHA1 (Auth Token) | Validation token handshake |
| **Primary SDK** | `@slack/bolt` 4.6.0 | `twilio` 5.11.2 | `@azure/msal-node` 3.8.7 |
| **Rate limit model** | Tier 1-4 per method | Per-number MPS + concurrent API | 10K/10min per app+mailbox |
| **Credential format** | `xoxb-` bot + `xoxp-` user tokens | `AC` SID + auth token | Bearer JWT + refresh token |
| **Scope delimiter** | Comma (`,`) | N/A | Space (` `) |
| **Similar to Google?** | Partially (OAuth, but dual tokens) | No (different auth model) | Very similar (OAuth + REST) |

---

## 6. Framework Design Implications

### 6.1 Auth Strategy Coverage

The three auth strategies in the framework cover all three services:
- `"oauth2"` → Slack, Outlook (and Google, HubSpot, Salesforce)
- `"api_key"` → Twilio (and ElevenLabs)
- No new auth strategies needed.

### 6.2 Slack Dual-Token Challenge

Slack's response includes both a bot token and a user token. The `processOAuthTokens()` method must:
1. Store the bot token as `accessToken`
2. Store the user token separately in `metadata.userAccessToken` (encrypted via `encryptToken()`)
3. The `search.messages` chat tool must decrypt and use the user token, not the bot token

### 6.3 Twilio Webhook Architecture

Each agent needs a routable webhook URL for incoming SMS/calls. Options:
1. **Shared URL with routing:** `POST /api/webhooks/twilio/sms` → route by `To` number to correct agent
2. **Per-agent URL:** `POST /api/webhooks/twilio/sms/{agentId}` → directly routes

Option 1 is simpler (single webhook URL per Twilio number) and matches how Twilio works (webhook configured per phone number).

### 6.4 Outlook Subscription Renewal

Graph subscriptions expire after 7 days and must be renewed. This requires:
- A cron job or background task that renews active subscriptions before expiry
- Similar to Google's `watch()` renewal pattern
- Store `subscriptionId` and `expirationDateTime` in `metadata`

### 6.5 Credential Push to VMs

All three services can follow the existing pattern:
- **Slack:** Push `{ botToken, userToken, teamId }` to `/internal/slack-credentials`
- **Twilio:** Push `{ accountSid, authToken, phoneNumbers }` to `/internal/twilio-credentials`
- **Outlook:** Push `{ accessToken, refreshToken, tokenExpiry, clientId, clientSecret }` to `/internal/outlook-credentials` (mirrors Google pattern exactly)

### 6.6 Environment Variables Needed

```
# Slack
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=

# Twilio (app-wide, but per-user credentials also stored in DB)
# No app-wide env vars needed — each user provides their own Account SID + Auth Token

# Microsoft / Outlook
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=common
```
