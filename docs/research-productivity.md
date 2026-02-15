# Productivity Integration Research: Google Calendar

> Phase 1 research for extending Google Calendar integration in Aura.
> This document covers authentication, API endpoints, rate limits, webhooks, SDK patterns, credential management, and current implementation status.

---

## 1. Current Implementation Status

Google Calendar is **already partially integrated** into Aura as part of the unified "Google Workspace" provider. Before designing the adapter, here's what already exists.

### 1.1 OAuth & Authentication (Complete)

Google Calendar shares the same OAuth 2.0 flow as Gmail, Drive, and Docs — a single "Google Workspace" consent screen.

**OAuth route:** `src/app/api/integrations/google/route.ts`
**Callback:** `src/app/api/integrations/google/callback/route.ts`

Scopes already requested:

| Scope | Service |
|-------|---------|
| `calendar.readonly` | Read calendars and events |
| `calendar.events` | Create, update, delete events |
| `gmail.readonly` | Read emails |
| `gmail.send` | Send emails |
| `drive.readonly` | Read Drive files |
| `documents.readonly` | Read Google Docs |
| `userinfo.email` | User email |
| `userinfo.profile` | User profile |

- `access_type=offline` — refresh token returned
- `prompt=consent` — always shows consent screen
- Tokens encrypted with AES-256-GCM before DB storage
- Token refresh via `src/lib/integrations/token-refresh.ts`
- Credential push to running VMs via `src/lib/integrations/credential-push.ts`

**No additional OAuth scopes are needed for Calendar.** The `calendar.events` scope covers create, update, and delete operations.

### 1.2 Calendar API Functions (Partial)

**File:** `src/lib/integrations/google-api.ts`

| Function | API Endpoint | Status |
|----------|-------------|--------|
| `listCalendarEvents()` | `events.list` on primary calendar | Implemented (line 199) |
| `createCalendarEvent()` | `events.insert` on primary calendar | Implemented (line 247) |
| Update event | `events.patch` / `events.update` | **Not implemented** |
| Delete event | `events.delete` | **Not implemented** |
| Get single event | `events.get` | **Not implemented** |
| Check availability | `freebusy.query` | **Not implemented** |
| List calendars | `calendarList.list` | **Not implemented** |
| Quick add | `events.quickAdd` | **Not implemented** |
| Recurring instances | `events.instances` | **Not implemented** |
| Watch for changes | `events.watch` | **Not implemented** |

### 1.3 Chat Tool Definitions (Partial)

**File:** `src/lib/integrations/chat-tools.ts`

| Tool | Status |
|------|--------|
| `list_calendar_events` | Implemented |
| `create_calendar_event` | Implemented |
| `update_calendar_event` | **Not implemented** |
| `delete_calendar_event` | **Not implemented** |
| `check_availability` | **Not implemented** |

### 1.4 VM-Side Execution (Partial)

**File:** `src/lib/provisioning/vm-google-skill.ts`

The generated `google-api.js` CLI on VMs includes:
- `calendar-list` — List events (implemented)
- `calendar-create` — Create event (implemented)
- Update/delete/availability — **Not implemented**

### 1.5 Integration Page UI (Complete)

The integration page is **fully built** with no gaps:

| Component | File | Status |
|-----------|------|--------|
| Page layout | `src/app/(dashboard)/integrations/page.tsx` | Complete |
| Grid with search/filter | `src/app/(dashboard)/integrations/integrations-grid.tsx` | Complete (418 lines) |
| Service card | `src/components/dashboard/integration-card.tsx` | Complete (194 lines) |
| Detail modal | `src/components/dashboard/integration-detail.tsx` | Complete (926 lines) |
| Connect/disconnect | Built into card + detail modal + `actions.ts` | Complete |
| Connection status | Badge (Connected / Available / Soon) | Complete |
| Loading skeleton | `IntegrationsGridSkeleton` in page.tsx | Complete |
| Provider definitions | `src/lib/integrations/providers.tsx` | Complete (40+ providers) |
| Category filter | DropdownMenu with 12 categories | Complete |
| Google sub-services | `googleServices` array (Calendar, Gmail, Drive, Docs) | Complete |
| Server actions | `src/app/(dashboard)/integrations/actions.ts` | Complete |

---

## 2. Google Calendar API v3 Reference

### 2.1 Authentication

| Detail | Value |
|--------|-------|
| API Base URL | `https://www.googleapis.com/calendar/v3` |
| Auth method | OAuth 2.0 Bearer token |
| Authorization header | `Authorization: Bearer {access_token}` |
| Token endpoint | `https://oauth2.googleapis.com/token` |
| Access token lifetime | ~1 hour (3600 seconds) |
| Refresh token lifetime | Indefinite (unless revoked or unused for 6 months) |

**Scopes relevant to Aura:**

| Scope | Access Level | Already Requested? |
|-------|-------------|-------------------|
| `calendar.readonly` | Read-only access to calendars and events | Yes |
| `calendar.events` | Read/write access to events | Yes |
| `calendar` | Full read/write to all calendar data | No (not needed — `calendar.events` suffices) |
| `calendar.events.readonly` | Read-only access to events only | No (covered by `calendar.readonly`) |
| `calendar.settings.readonly` | Read calendar settings | No (not needed for current scope) |
| `calendar.addons.execute` | Run Calendar add-ons | No (not relevant) |

**No scope changes needed.** The existing `calendar.readonly` + `calendar.events` combination provides full CRUD on events and read access to calendar metadata.

### 2.2 API Resources & Endpoints

#### Events (Primary Resource)

Base: `https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events`

| Method | HTTP | Endpoint | Description | Aura Status |
|--------|------|----------|-------------|-------------|
| `list` | GET | `/events` | List events with time range, filters | Implemented |
| `get` | GET | `/events/{eventId}` | Get single event by ID | **Gap** |
| `insert` | POST | `/events` | Create new event | Implemented |
| `update` | PUT | `/events/{eventId}` | Full update of event | **Gap** |
| `patch` | PATCH | `/events/{eventId}` | Partial update of event | **Gap** (preferred over update) |
| `delete` | DELETE | `/events/{eventId}` | Delete event | **Gap** |
| `quickAdd` | POST | `/events/quickAdd?text={text}` | Create from natural language | **Gap** |
| `instances` | GET | `/events/{eventId}/instances` | List recurring event instances | **Gap** |
| `import` | POST | `/events/import` | Import private copy of event | Not needed |
| `move` | POST | `/events/{eventId}/move?destination={calId}` | Move event to another calendar | Not needed |
| `watch` | POST | `/events/watch` | Subscribe to push notifications | **Gap** |

**Key parameters for `events.list`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `timeMin` | datetime (RFC 3339) | Lower bound (exclusive) for event end time |
| `timeMax` | datetime (RFC 3339) | Upper bound (exclusive) for event start time |
| `maxResults` | integer | Max events to return (default: 250) |
| `singleEvents` | boolean | Expand recurring events into instances |
| `orderBy` | string | `startTime` (requires singleEvents=true) or `updated` |
| `q` | string | Free text search terms |
| `showDeleted` | boolean | Include cancelled events |
| `pageToken` | string | Pagination token for next page |
| `updatedMin` | datetime | Lower bound for last modification time |

#### FreeBusy (Availability Check)

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `query` | POST | `/freeBusy` | Check availability across multiple calendars |

**Request body:**
```json
{
  "timeMin": "2026-02-15T09:00:00Z",
  "timeMax": "2026-02-15T18:00:00Z",
  "items": [
    { "id": "primary" },
    { "id": "colleague@company.com" }
  ]
}
```

**Response:**
```json
{
  "calendars": {
    "primary": {
      "busy": [
        { "start": "2026-02-15T10:00:00Z", "end": "2026-02-15T11:00:00Z" },
        { "start": "2026-02-15T14:00:00Z", "end": "2026-02-15T15:00:00Z" }
      ]
    }
  }
}
```

Use case for AI agent: "Find a 30-minute slot this afternoon for a meeting with X" — query freebusy for both users, find non-overlapping free slots.

#### CalendarList (User's Calendars)

Base: `https://www.googleapis.com/calendar/v3/users/me/calendarList`

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `list` | GET | `/calendarList` | List all calendars on user's list |
| `get` | GET | `/calendarList/{calendarId}` | Get specific calendar metadata |
| `insert` | POST | `/calendarList` | Add calendar to user's list |
| `delete` | DELETE | `/calendarList/{calendarId}` | Remove from user's list |
| `patch` | PATCH | `/calendarList/{calendarId}` | Update calendar settings |
| `watch` | POST | `/calendarList/watch` | Watch for changes to calendar list |

Use case: Let agent work with calendars beyond "primary" (e.g., team calendars, project calendars).

#### Calendars (Calendar Metadata)

Base: `https://www.googleapis.com/calendar/v3/calendars`

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `get` | GET | `/calendars/{calendarId}` | Get calendar metadata |
| `insert` | POST | `/calendars` | Create secondary calendar |
| `update` | PUT | `/calendars/{calendarId}` | Update calendar metadata |
| `patch` | PATCH | `/calendars/{calendarId}` | Partial update |
| `delete` | DELETE | `/calendars/{calendarId}` | Delete secondary calendar |
| `clear` | POST | `/calendars/{calendarId}/clear` | Delete ALL events in calendar |

#### ACL (Access Control)

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `list` | GET | `/calendars/{calendarId}/acl` | List access rules |
| `insert` | POST | `/calendars/{calendarId}/acl` | Create access rule |
| `delete` | DELETE | `/calendars/{calendarId}/acl/{ruleId}` | Remove access rule |
| `watch` | POST | `/calendars/{calendarId}/acl/watch` | Watch ACL changes |

#### Channels (Push Notification Management)

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `stop` | POST | `/channels/stop` | Stop receiving push notifications |

#### Colors

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `get` | GET | `/colors` | Get color definitions for calendars and events |

#### Settings

| Method | HTTP | Endpoint | Description |
|--------|------|----------|-------------|
| `list` | GET | `/users/me/settings` | List all user settings |
| `get` | GET | `/users/me/settings/{setting}` | Get specific setting |
| `watch` | POST | `/users/me/settings/watch` | Watch for settings changes |

### 2.3 Rate Limits & Quotas

| Quota Type | Limit |
|------------|-------|
| Daily queries per project | 1,000,000 |
| Per-minute per project | Check Cloud Console |
| Per-minute per user | Check Cloud Console (default ~25,000/100s) |
| Push notification channels | No documented limit |
| Cost | **Free** (no per-request charges) |

**Rate limit error codes:**
- `403` with `usageLimits` reason
- `429` with `usageLimits` reason

**Best practices:**
- Implement exponential backoff with jitter on 403/429
- Randomize sync times by ±25% to avoid synchronized spikes
- Use push notifications instead of polling (dramatically reduces quota usage)
- For service accounts with domain-wide delegation, use `quotaUser` parameter
- Avoid rapid successive writes to a single calendar (operational limits apply)

**Operational limits (separate from API quotas):**
- Maximum attendees per event: 300 (for Google Workspace accounts)
- Maximum calendars: varies by plan
- Rapid successive writes to one calendar may trigger operational throttling

### 2.4 Push Notifications (Webhooks)

Google Calendar supports push notifications via the Watch API. When a resource changes, Google sends an HTTPS POST to your webhook URL.

**Setup process:**

1. **Register webhook URL** — must be HTTPS with valid SSL certificate
2. **Create watch channel** — POST to `{resource}/watch`
3. **Receive notifications** — Google POSTs to your URL when resources change
4. **Fetch changes** — notification is a signal only (no event data in payload)

**Watch request (Events):**
```json
POST https://www.googleapis.com/calendar/v3/calendars/primary/events/watch

{
  "id": "unique-channel-id",
  "type": "web_hook",
  "address": "https://app.aura.com/api/webhooks/google-calendar",
  "token": "optional-verification-token",
  "expiration": 1739836800000
}
```

**Notification headers received:**

| Header | Description |
|--------|-------------|
| `X-Goog-Channel-ID` | Channel ID you specified |
| `X-Goog-Channel-Token` | Optional token you specified |
| `X-Goog-Channel-Expiration` | Channel expiration timestamp |
| `X-Goog-Resource-ID` | Opaque resource identifier |
| `X-Goog-Resource-URI` | API URI of the watched resource |
| `X-Goog-Resource-State` | `sync` (initial), `exists` (change), `not_exists` (deleted) |
| `X-Goog-Message-Number` | Notification sequence number |

**Key characteristics:**
- **Channel expiration:** Maximum ~1 week. Must be renewed before expiry.
- **No event data in payload:** The notification is a signal. You must call the API to get actual changes.
- **Sync message:** After creating a channel, Google sends a `sync` notification to confirm setup.
- **Supported resources:** Events, CalendarList, ACL, Settings.
- **Requires HTTPS:** No HTTP, no self-signed certs.
- **Domain verification:** Webhook domain must be verified in Google Search Console.

**Recommendation for Aura:** Push notifications are valuable for real-time calendar sync (e.g., agent reacts to newly created meetings). However, implementation requires:
1. A publicly accessible HTTPS webhook endpoint
2. Domain verification in Google Search Console
3. Channel renewal logic (cron or before-expiry refresh)
4. Incremental sync using `syncToken` to efficiently fetch only changes

Defer to Phase 2+ unless real-time calendar awareness is a priority.

### 2.5 SDK & API Access Pattern

**Current pattern in Aura:** Direct REST via `fetch()` — no googleapis npm package.

```typescript
// From src/lib/integrations/google-api.ts
async function googleFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API error (${res.status}): ${text}`);
  }
  return res.json();
}
```

**Alternative: `googleapis` npm package**
- Official Google SDK, ~800K weekly downloads
- TypeScript types included
- Handles pagination, retries, batching
- Significantly larger bundle size

**Recommendation:** Continue with direct `fetch()` for consistency with existing patterns. The Calendar API is straightforward REST — no pagination complexity for typical agent use cases (events in a time range).

### 2.6 Credential Format & Storage

Google Calendar uses the **same credentials** as Gmail, Drive, and Docs — stored as a single `integrations` row with `provider: "google"`.

```typescript
// integrations table row (already exists for connected users)
{
  provider: "google",
  accessToken: encryptToken(tokens.access_token),   // AES-256-GCM
  refreshToken: encryptToken(tokens.refresh_token),  // AES-256-GCM
  tokenExpiry: new Date(Date.now() + tokens.expires_in * 1000), // ~1 hour
  scopes: [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    // ...
  ],
  metadata: {
    email: "user@gmail.com",
    name: "User Name",
    picture: "https://lh3.googleusercontent.com/..."
  }
}
```

**No new environment variables needed.** Calendar uses the existing:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
INTEGRATION_ENCRYPTION_KEY=
```

**Credential delivery to VMs:**
- Push via `credential-push.ts` to all running agent instances
- VM stores at `/root/.google-creds/tokens.json`
- `google-api.js` CLI reads from disk, auto-refreshes if expired
- Same tokens work for both Gmail and Calendar operations

---

## 3. Gap Analysis: What's Needed for Phase 2 Adapter

### 3.1 Priority 1 — Core CRUD (Must Have)

These are essential for a functional Calendar adapter:

| Function | API | Why |
|----------|-----|-----|
| `updateCalendarEvent()` | `PATCH /events/{id}` | Reschedule, change title, add attendees |
| `deleteCalendarEvent()` | `DELETE /events/{id}` | Cancel meetings |
| `getCalendarEvent()` | `GET /events/{id}` | Get full event details by ID |

**Estimated implementation:** ~50 lines in `google-api.ts`, ~40 lines for chat tool definitions.

### 3.2 Priority 2 — Smart Scheduling (Should Have)

These enable intelligent scheduling capabilities:

| Function | API | Why |
|----------|-----|-----|
| `checkAvailability()` | `POST /freeBusy` | Find free slots across calendars |
| `listCalendars()` | `GET /calendarList` | Operate on non-primary calendars |

**Estimated implementation:** ~60 lines total.

### 3.3 Priority 3 — Advanced Features (Nice to Have)

| Function | API | Why |
|----------|-----|-----|
| `quickAddEvent()` | `POST /events/quickAdd` | Create from natural language |
| `getRecurringInstances()` | `GET /events/{id}/instances` | Manage recurring events |
| Push notifications | `POST /events/watch` | Real-time calendar sync |

### 3.4 VM-Side Skill Updates

The `google-api.js` CLI on VMs (generated by `vm-google-skill.ts`) needs matching commands:
- `calendar-update --id ID --summary S [--start ISO] [--end ISO] [--description D]`
- `calendar-delete --id ID`
- `calendar-get --id ID`
- `calendar-freebusy --start ISO --end ISO [--calendars a,b]`

---

## 4. Integration Page UI Assessment

### 4.1 Existing UI Is Complete

The integration page UI was already fully built before this task. All components exist and function correctly:

- **Page layout:** `src/app/(dashboard)/integrations/page.tsx` — Server component with Suspense + skeleton
- **Grid component:** `src/app/(dashboard)/integrations/integrations-grid.tsx` — Client component with search, category filter, "coming soon" toggle, and grouped category sections
- **Service card:** `src/components/dashboard/integration-card.tsx` — Shows icon, name, description, capabilities, connection status badge, and hover-revealed connect/manage button
- **Detail modal:** `src/components/dashboard/integration-detail.tsx` — Full detail view with status indicator, capabilities, scopes, API key forms (for non-OAuth providers), and connect/disconnect buttons
- **Server actions:** `src/app/(dashboard)/integrations/actions.ts` — `getUserIntegrations()`, `connectIntegration()`, `disconnectIntegration()`, `reconnectIntegration()`, etc.
- **Provider registry:** `src/lib/integrations/providers.tsx` — 40+ providers with metadata, capabilities, scopes, colors, docs URLs, and category assignments
- **Google sub-services:** `googleServices` array defines Calendar, Gmail, Drive, Docs as sub-services of the Google Workspace provider

### 4.2 Design Patterns Used

The integration UI follows the same patterns as the rest of the dashboard:

- **Card styling:** `border-[rgba(255,255,255,0.05)] bg-aura-surface transition-all hover:border-[rgba(79,143,255,0.12)]`
- **Status badges:** `bg-aura-mint/20 text-aura-mint` (connected), `bg-aura-text-dim/20 text-aura-text-dim` (available), `bg-aura-accent/20 text-aura-accent` (coming soon)
- **Grid layout:** `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`
- **Hover actions:** `opacity-0 transition-opacity group-hover:opacity-100`
- **Loading states:** Skeleton components matching card dimensions
- **Toast notifications:** Sonner for connect/disconnect feedback
- **Icons:** Lucide React (consistent with entire dashboard)

### 4.3 No New UI Components Needed

The existing integration page already satisfies all requirements:
- Grid of service cards with icons, descriptions, and capabilities
- Connect/disconnect buttons with OAuth and API key flows
- Connection status indicators (badges with color coding)
- Search, category filtering, and "coming soon" toggle
- Detail modals with scopes, documentation links, and credential forms

---

## 5. Key Architectural Insight

**Google Calendar is NOT a separate integration.** It shares OAuth tokens, credential storage, and VM-side execution with Gmail, Drive, and Docs under the unified "Google Workspace" provider.

This has implications for the adapter framework design:
1. The adapter should access the existing Google integration's tokens (provider="google")
2. No separate OAuth flow or credential storage needed
3. The adapter is purely an API interface layer on top of shared authentication
4. Token refresh is already handled by the common `refreshGoogleToken()` function
5. VM-side execution uses the same `google-api.js` CLI for all Google services

The framework should support **sub-service adapters** — multiple adapters (Calendar, Gmail, Drive) sharing one provider's OAuth connection.

---

## Sources

- [Google Calendar API v3 Reference](https://developers.google.com/workspace/calendar/api/v3/reference)
- [Google Calendar API Quota Management](https://developers.google.com/workspace/calendar/api/guides/quota)
- [Google Calendar Push Notifications](https://developers.google.com/workspace/calendar/api/guides/push)
- [Events: watch | Google Calendar](https://developers.google.com/workspace/calendar/api/v3/reference/events/watch)
- [FreeBusy: query | Google Calendar](https://developers.google.com/workspace/calendar/api/v3/reference/freebusy/query)
- [Google Calendar API Error Handling](https://developers.google.com/workspace/calendar/api/guides/errors)
