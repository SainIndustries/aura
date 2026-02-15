# Agent Integration Awareness Fix

**Date:** 2026-02-15
**Commit:** `acbe4e1` (rebased to `054ce82`)

---

## Problem

The OpenClaw agent didn't know which integrations were connected. When asked "What's on my calendar today?", the agent would respond with "I don't have access to your calendar" even though Google Workspace credentials were available on the VM. Only when pressed a second time would it actually attempt the API call — and it worked fine.

### Root Cause

The system prompt built by `buildSystemPrompt()` in `src/app/api/chat/route.ts` only included the agent's name and personality. It had no information about which integrations were connected. The agent had to guess whether tools were available, and it guessed wrong.

The SKILL.md on the VM told the agent: *"If the tool returns 'Google credentials not configured', tell the user to connect Google in the Aura dashboard."* This defensive instruction may have caused the agent to preemptively assume credentials weren't there.

---

## Fix: Integration-Aware System Prompt

### 1. Extended `buildSystemPrompt()` Signature

```typescript
function buildSystemPrompt(
  agentName?: string,
  agentPersonality?: string | null,
  connectedIntegrations?: Record<string, unknown>,
): string
```

When integrations are passed, the prompt includes a persistent section:

```
## Connected Integrations
You currently have access to the following integrations:
- Google Workspace (Gmail, Calendar, Drive, Contacts)
- Slack

Always attempt to use these tools when the user's request is relevant.
Do not tell the user you lack access to these services — they are
connected and available.
```

### 2. Extended `OpenClawInstance` Interface

Added `integrations: Record<string, unknown>` to the `OpenClawInstance` interface. The `getUserOpenClawInstance()` function now returns `agent.integrations` from the DB record (already queried, no extra DB call).

### 3. Both Streaming Paths Updated

- **OpenClaw path**: `buildSystemPrompt(instance.agentName, instance.agentPersonality, instance.integrations)`
- **Fallback LLM path**: `buildSystemPrompt(agentName, agentPersonality, agentIntegrations)`

The agent record's `integrations` field (JSON: `{ google: true, slack: true, ... }`) was already available in both code paths.

### Integration Key → Label Mapping

| Key | System Prompt Label |
|-----|-------------------|
| `google` | Google Workspace (Gmail, Calendar, Drive, Contacts) |
| `slack` | Slack |

Additional integrations can be added to the mapping as they're implemented.

---

## Bonus Fix: Duplicate Capability Messages

### Problem

Two parallel paths for showing capability messages in the chat UI could fire for the same provider:

1. **Flow A (sessionStorage)**: Integration page sets `aura_pending_integration_notification` in sessionStorage. Chat page reads it on mount.
2. **Flow B (polling detection)**: `AgentStatusProvider.refresh()` detects a new provider in `connectedProviders` and sets `newlyConnectedIntegration`.

If both fired, the user saw the capability message twice.

### Fix

Both flows now check if an `integration-{provider}-*` message already exists before injecting:

```typescript
setMessages((prev) => {
  if (prev.some((m) => m.id.startsWith(`integration-${provider}-`))) return prev;
  return [...prev, { id: `integration-${provider}-${Date.now()}`, ... }];
});
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/app/api/chat/route.ts` | `buildSystemPrompt` accepts `connectedIntegrations`, `OpenClawInstance` includes `integrations`, both streaming paths pass integrations |
| `src/app/(dashboard)/chat/page.tsx` | Capability message deduplication in both Flow A and Flow B |

## Combined Agent Awareness Flow

After all three fixes, the complete integration awareness flow is:

```
1. User connects Google via OAuth popup
   → Popup sends postMessage to parent → parent closes popup + refreshes
   → Frontend shows capability card immediately (deduplicated)

2. Credentials pushed to VM → written to disk
   → metadata.agentNotifiedAt is absent

3. User sends first message after connecting
   → System prompt includes "Connected Integrations" section (persistent)
   → System prompt includes "JUST CONNECTED" section (one-time)
   → Agent: "Google Workspace is connected! I can read your emails and
     manage your calendar. What's on your calendar today?"
   → agentNotifiedAt marked → one-time section won't repeat

4. User sends subsequent messages
   → System prompt still includes "Connected Integrations" (persistent)
   → Agent confidently uses Google tools without hesitation
```
