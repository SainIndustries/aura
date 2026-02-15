---
phase: 09-lifecycle-management
plan: 03
subsystem: infra
tags: [github-actions, hetzner, rollback, cleanup, idempotent]

# Dependency graph
requires:
  - phase: 09-01
    provides: VM lifecycle management core (deleteServer, deleteDevice)
  - phase: 08-01
    provides: Ansible provisioning workflow
provides:
  - Workflow-level VM cleanup on provision failure
  - Failure callback with server metadata for database-side rollback
  - Idempotent cleanup mechanisms (404 = success)
affects: [10-monitoring, future-phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent infrastructure cleanup (workflow + database)"
    - "Dual-layer rollback: workflow cleanup + callback handler cleanup"
    - "Conditional execution guards for cleanup steps"

key-files:
  created: []
  modified:
    - ".github/workflows/provision-agent.yml"

key-decisions:
  - "Dual-layer cleanup: workflow attempts immediate VM deletion, callback handler provides second layer with Tailscale cleanup"
  - "Idempotent deletion: 404 HTTP status treated as success for already-deleted resources"
  - "Conditional cleanup: only runs if server_id is non-empty (VM was actually created)"

patterns-established:
  - "Pattern 1: Workflow cleanup steps use if: failure() && outputs.server_id != '' guards"
  - "Pattern 2: Failure callbacks include full metadata (server_id, server_ip, tailscale_ip) for database-side operations"
  - "Pattern 3: Cleanup operations treat 404 as success (idempotency for concurrent/retry scenarios)"

# Metrics
duration: 54s
completed: 2026-02-13
---

# Phase 09 Plan 03: Provision Workflow Rollback Summary

**Orphaned Hetzner VM cleanup on provision failure via workflow deletion step and failure callback metadata for database-side rollback**

## Performance

- **Duration:** 54s
- **Started:** 2026-02-13T23:01:20Z
- **Completed:** 2026-02-13T23:02:14Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Added workflow-level Hetzner VM cleanup step that runs on failure
- Enhanced failure callback with server_id, server_ip, and tailscale_ip for database-side rollback
- Implemented idempotent cleanup (treats 404 as success)
- Conditional execution ensures cleanup only runs when VM was actually created

## Task Commits

Each task was committed atomically:

1. **Task 1: Add server_id to failure callback and add workflow-level rollback step** - `85dbcbd` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `.github/workflows/provision-agent.yml` - Added VM cleanup step on failure and enhanced failure callback with metadata

## Decisions Made

**1. Dual-layer cleanup strategy**
- Workflow provides first-line defense by attempting immediate Hetzner VM deletion
- Callback handler provides second layer via rollbackFailedProvision (also handles Tailscale device cleanup)
- Both layers are idempotent and best-effort

**2. Idempotent deletion pattern**
- HTTP 404 treated as success (resource already deleted)
- Enables safe retries and concurrent cleanup attempts
- Prevents workflow failures from cleanup step itself

**3. Conditional cleanup execution**
- Cleanup step only runs if: `failure() && steps.provision.outputs.server_id != ''`
- Prevents unnecessary API calls when provision step fails before creating VM
- Metadata fields (server_id, server_ip, tailscale_ip) may be empty strings - callback handler checks existence before attempting cleanup

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - straightforward workflow enhancement with well-defined failure conditions.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Lifecycle management complete with:
- VM creation and deletion (Plan 01)
- Database-side rollback function (Plan 02)
- Workflow-level cleanup with dual-layer rollback (Plan 03)

Ready for Phase 10 (monitoring and observability) or production deployment verification.

Key integration points for next phase:
- Workflow cleanup logs available for monitoring
- Failure callback metadata enables tracking of partial provisions
- Idempotent operations safe for retry/recovery mechanisms

---
*Phase: 09-lifecycle-management*
*Completed: 2026-02-13*

## Self-Check: PASSED

All claims verified:
- Modified file exists: .github/workflows/provision-agent.yml
- Task commit exists: 85dbcbd
