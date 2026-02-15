# Integration Bug Fix Report

**Date:** 2026-02-15
**Team:** integration-bugs
**Engineers:** state-investigator (Bugs #1 & #2), notification-engineer (Bug #3), qa-regression (QA)

---

## Bug #1 — False ElevenLabs Connection State

### Problem
Once a user connected ElevenLabs for any purpose, the voice chat button was enabled for **all** agents, including newly created ones. The connection state was tracked at the user level only, not per-agent.

### Root Cause
- **`/api/integrations/status`** returned `elevenlabs.connected` as a user-level boolean (querying the `integrations` table by userId)
- **`AgentStatusProvider`** exposed this as global `elevenlabsConnected` state
- **Chat page** used `elevenlabsConnected` directly to gate the voice button — no per-agent check existed

### Fix
- Chat page now derives `agentElevenlabsEnabled` from per-agent integrations data (`selectedAgent?.integrations.elevenlabs`)
- Voice button checks `agentElevenlabsEnabled` instead of global `elevenlabsConnected`
- Header shows a "Voice" badge only when the selected agent has ElevenLabs enabled
- `elevenlabsConnected` (user-level) is preserved for the `connectElevenLabsForAgent` branching logic

### Files Modified
| File | Change |
|------|--------|
| `src/app/(dashboard)/chat/page.tsx` | Voice button uses `agentElevenlabsEnabled` (per-agent), added "Connect Voice" button + "Voice" badge |

---

## Bug #2 — Per-Agent ElevenLabs Isolation Missing

### Problem
The `agents.integrations` JSONB column didn't track ElevenLabs. New agents were created with `integrations: null`. The status API only surfaced Google and Slack in per-agent data.

### Root Cause
- **`createAgent()`** omitted the `integrations` field entirely, defaulting to `null`
- **Status API** per-agent mapping only included `google` and `slack` — ElevenLabs was absent
- **`AgentIntegrations` interface** only declared `google` and `slack`

### Fix
- `createAgent()` now initializes `integrations: {}` — new agents start with an empty (but non-null) integrations object
- Status API per-agent mapping now includes `elevenlabs: !!agentIntegrations.elevenlabs && !!elevenlabsIntegration` (dual check: per-agent flag AND user-level connection)
- `AgentIntegrations` interface updated to include `elevenlabs: boolean`
- Fallback default updated to `{ google: false, slack: false, elevenlabs: false }`
- ElevenLabs API route (`POST`) accepts optional `agentId` to enable per-agent on initial connection
- New `PATCH` handler enables ElevenLabs on a specific agent when user already has a user-level connection

### Files Modified
| File | Change |
|------|--------|
| `src/app/(dashboard)/agents/actions.ts` | `createAgent()` sets `integrations: {}` |
| `src/app/api/integrations/status/route.ts` | Per-agent response includes `elevenlabs` boolean |
| `src/components/providers/agent-status-provider.tsx` | `AgentIntegrations` interface + fallback includes `elevenlabs` |
| `src/app/api/integrations/elevenlabs/route.ts` | `POST` accepts `agentId`; new `PATCH` for per-agent enablement |
| `src/app/(dashboard)/chat/page.tsx` | `connectElevenLabsForAgent` function, "Connect Voice" UI |

---

## Bug #3 — Missing Post-Connection Notification

### Problem
When a user connected an integration from the `/integrations` page (not via popup from the chat page), the capabilities message was never injected into the chat when they navigated there.

### Root Cause
- **`AgentStatusProvider`** used a ref (`connectedProvidersRef`) initialized to `null` to detect newly connected integrations via delta comparison between consecutive polls
- On first mount, the `if (connectedProvidersRef.current !== null)` guard skipped detection, then set the ref to current providers
- Integrations connected before the provider mounted (e.g., from `/integrations` page) were seen as "already there" and never triggered a notification
- The popup flow worked because the provider was already mounted with a baseline ref when the popup closed and `refresh()` was called

### Fix
- **Integrations grid** now sets `sessionStorage.setItem('aura_pending_integration_notification', providerId)` on all 3 connection paths: OAuth success, API key POST, and server action
- **Chat page** has a new `useEffect` that checks sessionStorage for `aura_pending_integration_notification` on mount/agent switch, injects the capabilities message using existing `getCapabilitiesMessage()`, and clears the flag
- The existing `newlyConnectedIntegration` mechanism (popup flow) is untouched

### Files Modified
| File | Change |
|------|--------|
| `src/app/(dashboard)/integrations/integrations-grid.tsx` | Sets sessionStorage flag on OAuth (line 126), API key (line 182), server action (line 199) |
| `src/app/(dashboard)/chat/page.tsx` | New useEffect reads + clears sessionStorage, injects capabilities message (lines 188-206) |

---

## Validation Results

### Bug #1 — Per-Agent Voice Button
| Test | Result |
|------|--------|
| Voice button uses `agentElevenlabsEnabled` (per-agent) | PASS |
| Voice button title uses per-agent state | PASS |
| "Voice" badge only shows for agents with ElevenLabs enabled | PASS |
| Global `elevenlabsConnected` preserved for branching logic | PASS |

### Bug #2 — Integration Isolation
| Test | Result |
|------|--------|
| `createAgent()` initializes `integrations: {}` | PASS |
| Status API includes `elevenlabs` in per-agent integrations | PASS |
| `AgentIntegrations` interface includes `elevenlabs: boolean` | PASS |
| Fallback default includes `elevenlabs: false` | PASS |
| ElevenLabs POST accepts optional `agentId` | PASS |
| New PATCH handler validates auth, agent ownership, user-level connection | PASS |
| Dual check pattern: per-agent flag AND user-level connection | PASS |
| `connectElevenLabsForAgent` branches on user-level state, enables per-agent | PASS |
| "Connect Voice" button shown for agents without ElevenLabs | PASS |

### Bug #3 — Post-Connection Notification
| Test | Result |
|------|--------|
| OAuth success sets sessionStorage | PASS |
| API key connection sets sessionStorage | PASS |
| Server action connection sets sessionStorage | PASS |
| Chat page reads + clears sessionStorage on mount | PASS |
| Uses existing `getProviderById` / `getCapabilitiesMessage` | PASS |
| Clears flag immediately (no duplicate on refresh) | PASS |
| Existing popup flow (`newlyConnectedIntegration`) untouched | PASS |

### Regression Checks
| Test | Result |
|------|--------|
| Google per-agent integration unaffected | PASS |
| Slack per-agent integration unaffected | PASS |
| Agent selector still works | PASS |
| Chat history persistence unaffected | PASS |

---

## Edge Cases Noted

1. **Multiple integrations before navigation:** If a user connects multiple integrations from `/integrations` before navigating to chat, only the last one shows a capabilities message (sessionStorage.setItem overwrites). This is consistent with the existing popup flow ("one at a time" behavior).

2. **User disconnects then reconnects ElevenLabs:** When ElevenLabs is disconnected at user level, the dual check (`!!agentIntegrations.elevenlabs && !!elevenlabsIntegration`) correctly returns `false` for all agents even though per-agent flags persist. On reconnection, previously-flagged agents automatically show as connected. This is the intended behavior — per-agent flags represent preference, user-level connection represents capability.

3. **`connectElevenLabsForAgent` silent failure:** If the PATCH request fails, the error is silently caught. This is consistent with the existing codebase pattern but could be improved with a toast notification in a future iteration.

---

## Summary

All 3 bugs have been fixed and validated. ElevenLabs voice is now correctly isolated per-agent, integration notifications work across page navigation, and no regressions were found in existing functionality.
