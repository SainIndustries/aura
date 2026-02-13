---
phase: 09
plan: 02
subsystem: provisioning
tags: [lifecycle, api-routes, webhooks, stripe, github, stop, start, destroy, rollback]

dependency_graph:
  requires:
    - phase: 09-01
      provides: "Lifecycle orchestrator functions (stopAgent, startAgent, destroyAgent, rollbackFailedProvision)"
  provides:
    - "User-facing stop/start/destroy API endpoints with real VM operations"
    - "Stripe subscription lifecycle handlers (cancellation destroys VMs, payment failure suspends)"
    - "GitHub callback rollback integration for failed provisions"
  affects:
    - dashboard-ui (will consume these API endpoints)
    - phase-10 (admin controls will use destroy endpoint)

tech_stack:
  added: []
  patterns:
    - "Backward compatibility pattern (check for serverId before calling lifecycle)"
    - "Error-tolerant batch operations (continue on failure, log errors)"
    - "Best-effort cleanup (log but don't fail webhook response)"

key_files:
  created:
    - src/app/api/agents/[id]/destroy/route.ts
  modified:
    - src/app/api/agents/[id]/start/route.ts
    - src/app/api/agents/[id]/stop/route.ts
    - src/app/api/webhooks/stripe/route.ts
    - src/app/api/webhooks/github/route.ts

decisions:
  - "Split Stripe subscription.updated and subscription.deleted into separate cases for clarity"
  - "Continue processing remaining agents even if one lifecycle operation fails"
  - "Make rollback best-effort (log errors but don't fail callback response)"

metrics:
  duration: 161s
  tasks_completed: 2
  files_created: 1
  files_modified: 4
  commits: 2
  completed_at: "2026-02-13T23:04:00Z"
---

# Phase 09 Plan 02: Lifecycle API Integration Summary

**Wired lifecycle orchestrator to user-facing API routes and system webhooks enabling real VM stop/start/destroy operations, subscription-driven lifecycle management, and automatic rollback on provision failure.**

## Performance

- **Duration:** 161s (2 min 41s)
- **Started:** 2026-02-13T23:01:18Z
- **Completed:** 2026-02-13T23:04:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- User-facing stop/start/destroy operations trigger real Hetzner VM power management
- Stripe subscription cancellation automatically destroys all running agents for affected user
- Stripe payment failure automatically suspends (stops, preserves data) all running agents
- GitHub callback triggers automatic rollback of orphaned resources on provision failure
- All integrations maintain backward compatibility for legacy agents without infrastructure

## Task Commits

Each task was committed atomically:

1. **Task 1: Update start/stop API routes and create destroy route** - `10aaf3b` (feat)
2. **Task 2: Add subscription lifecycle handlers and provision rollback** - `4b1ce34` (feat)

## Files Created/Modified

### Created
- `src/app/api/agents/[id]/destroy/route.ts` - Agent destruction endpoint calling destroyAgent orchestrator

### Modified
- `src/app/api/agents/[id]/start/route.ts` - Now calls startAgent() for real VM power-on (backward compatible)
- `src/app/api/agents/[id]/stop/route.ts` - Now calls stopAgent() for real VM shutdown (backward compatible)
- `src/app/api/webhooks/stripe/route.ts` - Added subscription.deleted handler (destroys VMs) and invoice.payment_failed handler (suspends VMs)
- `src/app/api/webhooks/github/route.ts` - Added rollbackFailedProvision call on status=failed

## Implementation Details

### API Routes (Task 1)

**Start/Stop Routes:** Both routes follow the same pattern:
1. Auth check and agent ownership verification
2. Check agent status (must be "paused" for start, "active" for stop)
3. Query for agent instance with serverId
4. If instance with serverId exists: call lifecycle orchestrator (startAgent/stopAgent)
5. If no serverId (legacy/simulated agent): fall back to simple DB status update
6. Log audit event
7. Return success response

**Error handling:** Lifecycle calls wrapped in try/catch, return 500 with detailed error message on failure.

**Destroy Route:** New endpoint for agent destruction (used by subscription cancellation webhook and future admin tools):
1. Auth check and agent ownership verification
2. Query for any agent instance (any status) with serverId
3. If instance with serverId: call destroyAgent (handles Hetzner VM delete + Tailscale cleanup + DB updates)
4. If no serverId: fall back to DB-only status updates
5. Audit log with "agent_destroyed" action
6. Return success response

### Webhook Handlers (Task 2)

**Stripe Webhook Changes:**

Split the combined `customer.subscription.updated | deleted` case into separate handlers:

1. **customer.subscription.updated:** Just calls upsertSubscription (existing behavior)
2. **customer.subscription.deleted:** Calls upsertSubscription PLUS destroys all running agents:
   - Extract customerId, look up user by stripeCustomerId
   - Find all agents with running instances for this user
   - For each agent with running instance + serverId: call destroyAgent
   - Wrap each destroy in try/catch, log errors but continue to next agent
   - This ensures subscription cancellation triggers full infrastructure cleanup

Split the combined `invoice.paid | payment_failed` case into separate handlers:

1. **invoice.paid:** Just calls upsertSubscription (existing behavior)
2. **invoice.payment_failed:** Calls upsertSubscription PLUS suspends all running agents:
   - Extract customerId, look up user by stripeCustomerId
   - Find all agents with running instances for this user
   - For each agent with running instance + serverId: call stopAgent (preserves data, just powers off VM)
   - Wrap each stop in try/catch, log errors but continue to next agent
   - This provides grace period for payment recovery without destroying user data

**GitHub Callback Changes:**

Added rollback trigger after failed status update:
- After calling updateJobStatus with status="failed"
- Call rollbackFailedProvision(job_id) to clean up orphaned Hetzner VMs and Tailscale devices
- Wrap in try/catch, log errors but don't fail the callback response (best-effort cleanup)
- This ensures provision failures don't leave orphaned infrastructure resources

## Decisions Made

### 1. Split Stripe Event Handlers

**Decision:** Separate combined cases (`subscription.updated | deleted` and `invoice.paid | payment_failed`) into distinct handlers.

**Rationale:** Makes lifecycle logic clear and maintainable. subscription.deleted needs destruction logic, subscription.updated doesn't. payment_failed needs suspension logic, invoice.paid doesn't.

**Alternative considered:** Keep combined cases with nested if statements - rejected as less readable.

### 2. Continue on Individual Failures

**Decision:** When processing multiple agents (subscription cancellation, payment failure), wrap each lifecycle call in try/catch and continue processing remaining agents even if one fails.

**Rationale:** A single agent's infrastructure issue (e.g., Hetzner API timeout) shouldn't block cleanup of other agents. Log the error for manual intervention but continue batch operation.

**Alternative considered:** Fail immediately on first error - rejected as it leaves other agents in inconsistent state.

### 3. Best-Effort Rollback

**Decision:** Make provision rollback best-effort: log errors but don't fail the callback response.

**Rationale:** The provision has already failed. If rollback also fails (e.g., resource already deleted manually), we don't want to return 500 and cause GitHub Actions to retry the callback. Log for monitoring/manual cleanup instead.

**Alternative considered:** Fail callback on rollback failure - rejected as it creates retry loops.

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

### For Dashboard UI
- `POST /api/agents/[id]/start` - Start a paused agent (powers on VM if infrastructure exists)
- `POST /api/agents/[id]/stop` - Stop a running agent (gracefully shuts down VM if infrastructure exists)
- `POST /api/agents/[id]/destroy` - Destroy agent and clean up all infrastructure

### For System Events
- Stripe subscription.deleted → automatic VM destruction
- Stripe invoice.payment_failed → automatic VM suspension (preserves data)
- GitHub provision failure → automatic rollback of orphaned resources

### Backward Compatibility
All endpoints check for serverId before calling lifecycle orchestrator. Agents without infrastructure (simulated/legacy) fall back to DB-only status updates.

## Verification Results

All verification criteria met:

✓ TypeScript compilation passes with zero errors
✓ Stop route imports and calls stopAgent from lifecycle module
✓ Start route imports and calls startAgent from lifecycle module
✓ Destroy route exists and calls destroyAgent
✓ Stripe webhook has separate handler for customer.subscription.deleted that calls destroyAgent
✓ Stripe webhook handles invoice.payment_failed by calling stopAgent (suspend, not destroy)
✓ GitHub callback handler triggers rollbackFailedProvision on status=failed
✓ All routes maintain backward compatibility for agents without infrastructure

## Success Criteria Met

✓ User-facing stop/start/destroy operations trigger real Hetzner API calls via lifecycle orchestrator
✓ System automatically destroys VMs on subscription cancellation
✓ System automatically suspends agents on payment failure (preserves data for recovery)
✓ Failed provisions trigger automatic rollback of orphaned resources
✓ All operations are resilient (continue on individual failures, log for monitoring)

## Next Phase Readiness

**Ready for Phase 10:** Admin controls can now use the destroy endpoint for manual cleanup. Dashboard UI can consume start/stop/destroy endpoints with confidence that they trigger real infrastructure operations.

**System lifecycle complete:** The full agent lifecycle is now automated:
1. User subscribes → provision workflow → running VM
2. User clicks stop → VM shutdown (preserves data)
3. User clicks start → VM power-on (resumes from stopped state)
4. User cancels subscription → automatic VM destruction + Tailscale cleanup
5. Payment fails → automatic suspension (grace period for recovery)
6. Provision fails → automatic rollback of orphaned resources

## Self-Check: PASSED

**Created files exist:**
```
FOUND: src/app/api/agents/[id]/destroy/route.ts
```

**Modified files verified:**
```
FOUND: src/app/api/agents/[id]/start/route.ts
FOUND: src/app/api/agents/[id]/stop/route.ts
FOUND: src/app/api/webhooks/stripe/route.ts
FOUND: src/app/api/webhooks/github/route.ts
```

**Commits exist:**
```
FOUND: 10aaf3b (Task 1: API routes)
FOUND: 4b1ce34 (Task 2: Webhook handlers)
```

All claims in summary validated against actual implementation.

---
*Phase: 09-lifecycle-management*
*Completed: 2026-02-13*
