# Phase 6: Async Pipeline Foundation - Context

**Gathered:** 2026-02-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish the async orchestration pattern for long-running infrastructure operations. Stripe webhook receives payment event, queues a provisioning job in PostgreSQL, triggers GitHub Actions workflow, and receives status callbacks. This phase builds the pipeline skeleton — actual VM creation (Phase 7), Ansible config (Phase 8), and lifecycle controls (Phase 9) plug into it later.

</domain>

<decisions>
## Implementation Decisions

### Provisioning trigger flow
- Full flow: Wizard step 4 submit → create agent as "draft" + redirect to Stripe Checkout → payment succeeds → `checkout.session.completed` webhook fires → creates subscription + queues provisioning job → GitHub Actions runs → VM provisioned
- The trigger is the Stripe webhook, not a manual deploy button
- Wizard Review step (step 4) both creates the agent record AND redirects to Stripe Checkout in one action
- Per-agent checkout: paying for this agent creates the subscription and triggers provisioning in a single flow

### Status progression
- 3 simple states: Queued → Provisioning → Running
- Machine states only — no human-readable messages. Human-friendly text is a UI concern for Phase 10
- Provisioning states only for now — destruction/stopped states added in Phase 9
- Job records kept forever for audit/debugging

### Failure & retry behavior
- Manual retry only — system marks job as failed, user clicks "retry" in dashboard (Phase 10)
- Auto-cleanup on failure — delete orphaned VMs/resources automatically, clean slate for retry
- Store error details — save error message, which step failed, and workflow run ID
- Capped retries: 3-5 attempts per agent before requiring support intervention (prevents cost spirals from repeated failures)

### Concurrent provisioning
- One provision at a time per user — block additional provisions with a message if one is already in progress
- Parallel across users — multiple users can provision simultaneously (independent GitHub Actions runs)
- No system-wide concurrency cap for now — at 50-200 agents, unlikely to hit issues

### Job lifecycle & timeouts
- Timeout: minimum 10 minutes (Claude to determine exact value based on pipeline stages, erring conservative)
- Heartbeat mechanism: GitHub Actions workflow periodically signals it's still alive. System distinguishes alive-but-slow from truly stuck.
- Stale job cleanup strategy: Claude's discretion on background sweep vs on-demand detection

### Claude's Discretion
- Exact timeout value (minimum 10 minutes)
- Terminal failure state design (explicit "failed" state vs staying at last state)
- Stale job cleanup mechanism (background sweep vs on-demand)
- Heartbeat interval and missed-heartbeat threshold
- Database schema details for job queue table
- GitHub Actions trigger mechanism (repository dispatch vs workflow dispatch)

</decisions>

<specifics>
## Specific Ideas

- Current codebase has simulated provisioning at `src/lib/provisioning/simulator.ts` — to be replaced with real pipeline
- Existing Stripe webhook handler at `src/app/api/webhooks/stripe/route.ts` — to be enhanced with provisioning job creation
- Existing `agentInstances` table already tracks: serverId, serverIp, tailscaleIp, region, error, status — pipeline should use/extend this
- LLM config from wizard step 2 is currently NOT saved to database (collected but lost) — noted gap, may need addressing
- Agent creation currently saves as "draft" status with no payment gate — flow needs to change to include Stripe redirect

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-async-pipeline-foundation*
*Context gathered: 2026-02-13*
