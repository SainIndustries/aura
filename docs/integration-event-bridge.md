# Integration Notification Pipeline

**Date:** 2026-02-15
**Commit:** `acbe4e1` (rebased to `054ce82`)

---

## Problem

After a user connects an integration (e.g., Google Workspace), the OpenClaw agent on the VM doesn't know about it. Credentials are pushed to the VM and written to disk, but the agent is never notified. When the user asks "check my email," the agent gives a canned "I don't have access" response instead of attempting the API call.

### Previous Flow (Broken)

```
User completes OAuth → Callback stores tokens in DB
  → pushGoogleCredentialsToRunningInstances() pushes to VM
    → cred-receiver writes /root/.google-creds/tokens.json
      → OpenClaw is unaware (never notified)
        → User asks about email → Agent assumes no access
```

---

## Design Decision: Chat-Time Injection vs VM-Side Notification

**Considered approaches:**

| Approach | Pros | Cons |
|----------|------|------|
| VM cred-receiver notifies OpenClaw via IPC | Real-time, fires immediately | Requires new VM endpoints, Caddy routes, systemd changes, VM reprovisioning |
| WebSocket/SSE from Aura to VM | Push-based, low latency | Adds persistent connection infrastructure, complexity |
| **Chat-time system prompt injection** | No VM changes, works with existing VMs, fires at the right moment | Agent only learns on next message (not immediately) |

**Chosen: Chat-time injection.** The agent can only respond when the user sends a message anyway, so injecting the notification at that moment is the natural trigger point. No VM reprovisioning, no new infrastructure.

The frontend already shows an immediate capability message to the user (via `newlyConnectedIntegration` in `AgentStatusProvider`), so there's no gap in user experience — the agent-side acknowledgment simply happens on the next interaction.

---

## Implementation

### New Module: `src/lib/integrations/notification.ts`

Three exports:

#### `getPendingNotifications(userId: string): Promise<PendingNotification[]>`
Queries the `integrations` table for this user. Returns integrations where:
- `accessToken` is set (actually connected)
- `metadata.agentNotifiedAt` is absent (not yet announced)

#### `markNotified(integrationId: string): Promise<void>`
Reads current `metadata` from the integration row, merges in `{ agentNotifiedAt: ISO timestamp }`, and updates the row. Uses the existing JSONB column — no schema migration.

#### `buildNotificationPromptSection(providers: string[]): string`
Builds a system prompt section for un-notified integrations:

```
## JUST CONNECTED
The following integration(s) were just connected by the user:
- **Google Workspace** is now connected. You can read/send emails via Gmail and view/create Google Calendar events.

At the START of your next response, briefly acknowledge the new connection
and mention what you can now do. Keep it to 1-2 sentences, then address
the user's message normally.
```

Provider-specific capabilities are mapped for: Google, Slack, HubSpot, Salesforce, Microsoft 365, Twilio. Unknown providers get a generic fallback.

### Modified: `src/app/api/chat/route.ts`

In the main `POST` handler, before starting the SSE stream:

1. Query `getPendingNotifications(user.id)`
2. If any exist, call `buildNotificationPromptSection()` to build the prompt section
3. Append the notification section to the system prompt (after `buildSystemPrompt()`)
4. After successful streaming, call `markNotified()` for each pending integration (fire-and-forget)

The notification section is passed through to both `streamFromOpenClaw()` and `streamFromFallbackLLM()`.

---

## Notification Lifecycle

```
1. User connects Google → OAuth callback stores tokens
   → metadata = { email, name, picture }  (no agentNotifiedAt)

2. User sends chat message → POST /api/chat
   → getPendingNotifications() finds Google (no agentNotifiedAt)
   → System prompt includes "JUST CONNECTED" section
   → Agent acknowledges: "Google Workspace is now connected! I can..."
   → markNotified() sets metadata.agentNotifiedAt = "2026-02-15T..."

3. User sends another message → POST /api/chat
   → getPendingNotifications() returns empty (agentNotifiedAt is set)
   → No notification section in prompt
   → Agent responds normally

4. User disconnects and reconnects Google
   → OAuth callback overwrites metadata = { email, name, picture }
   → agentNotifiedAt is cleared (metadata overwritten)
   → Next chat message triggers notification again
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/integrations/notification.ts` | **New** — notification queries, marking, prompt builder |
| `src/app/api/chat/route.ts` | Check pending notifications, inject into system prompt, mark after streaming |

## No Schema Migration

Uses the existing `integrations.metadata` JSONB column. The `agentNotifiedAt` field is added/cleared dynamically within the JSON object.

## Edge Cases

- **Rapid messages**: Small window where two messages could both include the notification (markNotified fires after streaming). Acceptable — worst case is a duplicate acknowledgment.
- **Streaming failure**: If the stream fails, notifications are NOT marked as delivered, so they'll retry on the next message.
- **Multiple integrations at once**: All pending providers are included in a single notification section.
- **Unknown providers**: Generic fallback message ("X connected! You can use its features.").
