---
phase: 09
plan: 01
subsystem: provisioning
tags: [lifecycle, vm-management, hetzner, tailscale, cleanup, orchestration]

dependency_graph:
  requires:
    - hetzner.ts (createServer, deleteServer, waitForAction)
    - tailscale.ts (verifyEnrollment, getOAuthToken)
    - db/schema.ts (agentInstances, agents, provisioningJobs)
  provides:
    - VM power management (shutdown, poweron, poweroff)
    - Device cleanup (listDevices, deleteDevice, findDeviceByIp)
    - Lifecycle orchestrators (stopAgent, startAgent, destroyAgent, rollbackFailedProvision)
  affects:
    - src/lib/hetzner.ts (extended with power management)
    - src/lib/tailscale.ts (extended with device management)
    - provisioning-queue.ts (can now call rollback on failure)

tech_stack:
  added: []
  patterns:
    - Idempotent cleanup (404 = success)
    - Graceful-to-forced fallback (shutdown → poweroff)
    - Atomic state transitions with rollback on failure
    - Error-tolerant cleanup in destroy/rollback operations

key_files:
  created:
    - src/lib/provisioning/lifecycle.ts
  modified:
    - src/lib/hetzner.ts
    - src/lib/tailscale.ts

decisions:
  - decision: "Use graceful shutdown with 60s timeout, fallback to forced poweroff"
    rationale: "Prevents data loss when possible, but ensures operation completes"
    alternatives: ["Immediate poweroff", "Longer timeout"]

  - decision: "Make deleteServer and deleteDevice idempotent (404 = success)"
    rationale: "Critical for rollback scenarios where resources may already be deleted"
    alternatives: ["Fail on 404", "Check existence before delete"]

  - decision: "Use 'provisioning' status as transitional state for startAgent"
    rationale: "Reuse existing enum value instead of adding 'starting' status"
    alternatives: ["Add 'starting' to provisioningStatusEnum", "Use custom status"]

  - decision: "Continue cleanup even if individual deletions fail in destroyAgent/rollback"
    rationale: "Best-effort cleanup prevents orphaned resources, log errors for manual intervention"
    alternatives: ["Fail immediately on first error", "Retry failed deletions"]

metrics:
  duration: 125s
  tasks_completed: 2
  files_created: 1
  files_modified: 2
  commits: 2
  completed_at: "2026-02-13T22:58:44Z"
---

# Phase 09 Plan 01: VM Lifecycle Management Core Summary

**One-liner:** Extended Hetzner/Tailscale clients with power/device management and built lifecycle orchestrator for stop/start/destroy/rollback operations with idempotent cleanup.

## What Was Built

### Hetzner Power Management (hetzner.ts)

Added three power management functions:

1. **shutdownServer** - Graceful ACPI shutdown with 60s timeout, falls back to poweroff
2. **powerOnServer** - Power on stopped VM
3. **powerOffServer** - Forceful power off (marked with data loss warning)

All follow existing patterns (fetchWithRateLimit, getHetznerConfig, waitForAction).

**Critical change:** Made `deleteServer` idempotent by treating 404 as success instead of throwing error. This is essential for rollback scenarios where a server may already be deleted.

### Tailscale Device Management (tailscale.ts)

Added three device management functions:

1. **listDevices** - Fetch all devices in Tailnet
2. **deleteDevice** - Remove device from network (idempotent, 404 = success)
3. **findDeviceByIp** - Helper to locate device by Tailscale IP

All use getOAuthToken for authentication, consistent with existing module.

### Lifecycle Orchestrator (lifecycle.ts)

Created new module with four orchestration functions:

1. **stopAgent** - Graceful shutdown with atomic state transitions (running → stopping → stopped), rollback to running on failure
2. **startAgent** - Power on with atomic state transitions (stopped → provisioning → running), rollback to stopped on failure
3. **destroyAgent** - Idempotent cleanup of Hetzner VM and Tailscale device with error-tolerant best-effort approach
4. **rollbackFailedProvision** - Cleanup orphaned resources after provision failure, tracks what was successfully cleaned

**Key patterns:**
- Atomic database updates with transaction-like behavior (update status, perform operation, update final status)
- Rollback on failure for stop/start operations
- Error-tolerant cleanup (log errors, continue with remaining cleanup)
- Detailed error messages tracking cleanup success/failure

## Deviations from Plan

None - plan executed exactly as written.

## Technical Decisions

### 1. Graceful-to-Forced Fallback Pattern

Implemented shutdownServer with 60-second timeout before falling back to poweroff. This prevents data loss when possible while ensuring operations complete even if guest OS is unresponsive.

### 2. Idempotent Cleanup as Core Design

Made both deleteServer and deleteDevice treat 404 responses as success rather than errors. This is critical for:
- Rollback scenarios where resources may be partially deleted
- Retry logic where previous attempts may have partially succeeded
- Manual cleanup interventions

### 3. Error-Tolerant Cleanup in Destroy Operations

destroyAgent and rollbackFailedProvision continue cleanup even if individual deletions fail, logging errors rather than throwing. This prevents a single failure (e.g., Tailscale API down) from leaving Hetzner resources orphaned.

### 4. State Transition Atomicity

Both stopAgent and startAgent use three-phase state transitions with rollback on failure:
1. Update to transitional state
2. Perform operation (shutdown/poweron)
3. Update to final state, or rollback to original state on error

This ensures database state always reflects reality even during failures.

## Files Modified

### Created
- `src/lib/provisioning/lifecycle.ts` (297 lines) - Four orchestrator functions with atomic state management

### Modified
- `src/lib/hetzner.ts` (+192 lines) - Added shutdownServer, powerOnServer, powerOffServer, made deleteServer idempotent
- `src/lib/tailscale.ts` (+94 lines) - Added listDevices, deleteDevice, findDeviceByIp

## Verification Results

All verification criteria met:

✓ TypeScript compilation passes with zero errors
✓ Hetzner module exports 7 async functions (4 existing + 3 new)
✓ Tailscale module exports 6 async functions (3 existing + 3 new)
✓ Lifecycle module exports 4 orchestrator functions
✓ deleteServer handles 404 idempotently
✓ deleteDevice handles 404 idempotently

## Integration Points

### For Plan 02 (API Routes)
- `stopAgent(agentId)` - Call from POST /api/agents/[id]/stop
- `startAgent(agentId)` - Call from POST /api/agents/[id]/start
- `destroyAgent(agentId)` - Call from DELETE /api/agents/[id]

### For Plan 03 (Workflow Integration)
- `rollbackFailedProvision(jobId)` - Call from provision workflow on failure
- Integrate into existing provision-agent.yml failure callback

### For Future Phases
- Lifecycle orchestrator provides foundation for scheduled operations (auto-stop, scheduled starts)
- Power management enables cost optimization (stop agents during off-hours)
- Rollback enables safe retry logic for provision failures

## Success Criteria Met

✓ Core lifecycle logic complete: VMs can be stopped/started/destroyed
✓ Tailscale devices can be cleaned up
✓ Failed provisions can be rolled back
✓ All operations are idempotent
✓ Error handling is graceful with detailed logging

## Self-Check: PASSED

**Created files exist:**
```
FOUND: src/lib/provisioning/lifecycle.ts
```

**Modified files verified:**
```
FOUND: src/lib/hetzner.ts
FOUND: src/lib/tailscale.ts
```

**Commits exist:**
```
FOUND: 5d7a7e4 (Task 1: Power management and device cleanup)
FOUND: 0e6d364 (Task 2: Lifecycle orchestrator)
```

**Function counts verified:**
```
Hetzner: 7 exported async functions
Tailscale: 6 exported async functions
Lifecycle: 4 exported async functions
```

**Idempotency verified:**
```
✓ deleteServer handles 404
✓ deleteDevice handles 404
```

All claims in summary validated against actual implementation.
