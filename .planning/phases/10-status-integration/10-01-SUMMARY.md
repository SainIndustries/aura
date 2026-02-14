---
phase: 10-status-integration
plan: 01
subsystem: provisioning-pipeline
tags: [backend, database, api, status-tracking]
dependency_graph:
  requires:
    - phase-09 lifecycle management (rollback on failure)
    - phase-08 Ansible configuration workflow
    - phase-07 VM provisioning and Tailscale setup
  provides:
    - granular-step-progress-tracking
    - real-time-step-status-api
    - workflow-step-callbacks
  affects:
    - src/lib/provisioning/queue.ts (step update function)
    - src/lib/provisioning/index.ts (step derivation logic)
    - src/app/api/webhooks/github/route.ts (callback handler)
    - src/app/api/agents/[id]/instance/route.ts (instance API)
tech_stack:
  added:
    - currentStep database column for step tracking
  patterns:
    - step-to-UI-index mapping for granular progress
    - backward-compatible step derivation (null currentStep support)
    - best-effort step updates (non-blocking callbacks)
key_files:
  created:
    - drizzle/0004_fearless_the_liberteens.sql (migration for currentStep)
  modified:
    - src/lib/db/schema.ts (agentInstances.currentStep column)
    - src/lib/provisioning/queue.ts (updateProvisioningStep function)
    - src/lib/provisioning/index.ts (step-aware getProvisioningSteps)
    - src/app/api/webhooks/github/route.ts (step callback handling)
    - src/app/api/agents/[id]/instance/route.ts (currentStep passed to UI)
decisions:
  - workflow-step-to-ui-mapping: "Map workflow identifiers (vm_created, ansible_started) to UI step indices for consistent progress display"
  - backward-compatibility: "Support null currentStep for legacy provisioning callbacks that don't send step field"
  - best-effort-updates: "Step updates log warnings instead of throwing errors when job/instance not found"
  - terminal-state-cleanup: "Clear currentStep when transitioning to running status to avoid stale data"
metrics:
  duration: 358s
  tasks_completed: 2
  files_modified: 7
  commits: 3
  completed_date: 2026-02-14
---

# Phase 10 Plan 01: Granular Provisioning Step Tracking Summary

**One-liner:** Backend now receives, stores, and serves granular provisioning step progress (vm_created, ansible_started, etc.) enabling real-time UI step visualization.

## What Was Built

Implemented the backend pipeline for granular provisioning step tracking:

1. **Database Schema**: Added `currentStep` column to `agentInstances` table to store workflow step identifiers
2. **Step Update Function**: Created `updateProvisioningStep()` in queue.ts for best-effort step progress storage
3. **Callback Handler**: Extended GitHub webhook to handle `step` field in provisioning callbacks
4. **Step Derivation**: Refactored `getProvisioningSteps()` to map real workflow steps to UI step states
5. **Instance API**: Updated GET endpoint to pass `currentStep` to step derivation function

The frontend provisioning status UI already polls the instance API and renders steps - it now displays real progress without any component changes.

## Technical Implementation

### Database Schema

Added nullable `currentStep` column to `agentInstances` table:
- Stores workflow step identifiers: "vm_created", "network_configured", "ansible_started", "ansible_complete"
- Cleared on terminal status transitions to avoid stale data
- Migration: `drizzle/0004_fearless_the_liberteens.sql`

### Workflow Step Mapping

Mapping from workflow identifiers to UI step indices:

| Workflow Step      | UI Steps Completed | Active UI Step           |
|--------------------|--------------------|--------------------------|
| vm_created         | 0, 1               | Installing Dependencies  |
| network_configured | 0, 1               | Installing Dependencies  |
| ansible_started    | 0, 1, 2            | Configuring Agent        |
| ansible_complete   | 0, 1, 2, 3         | Running                  |

UI Steps: Queued (0), Creating Server (1), Installing Dependencies (2), Configuring Agent (3), Running (4)

### Callback Flow

GitHub Actions workflow sends step updates:

```json
{
  "job_id": "uuid",
  "status": "provisioning",
  "step": "vm_created"
}
```

Callback handler routing:
1. Heartbeat → `recordHeartbeat()`
2. Step update → `updateProvisioningStep()` (NEW - early return)
3. Status with metadata → `completeProvisioningWithMetadata()`
4. Status only → `updateJobStatus()`

### API Response

GET `/api/agents/[id]/instance` now returns:

```json
{
  "instance": {
    "status": "provisioning",
    "currentStep": "ansible_started",
    ...
  },
  "steps": [
    { "id": "queued", "label": "Queued", "status": "completed" },
    { "id": "creating", "label": "Creating Server", "status": "completed" },
    { "id": "installing", "label": "Installing Dependencies", "status": "completed" },
    { "id": "configuring", "label": "Configuring Agent", "status": "active" },
    { "id": "running", "label": "Running", "status": "pending" }
  ]
}
```

## Verification Results

All verification tests passed:

1. **Step derivation (vm_created)**: Steps 0,1 completed → step 2 active ✓
2. **Step derivation (ansible_started)**: Steps 0,1,2 completed → step 3 active ✓
3. **Backward compatibility (null step)**: Step 0 completed → step 1 active ✓
4. **Running status**: All steps completed ✓
5. **Failed status (with step)**: Steps before error completed → error step marked ✓

TypeScript compilation successful (build errors due to missing DATABASE_URL expected in local environment).

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **Workflow-to-UI mapping**: Workflow steps are implementation details; UI shows user-friendly stages. Mapping layer enables workflow changes without UI updates.

2. **Backward compatibility**: Support null `currentStep` for legacy callbacks that don't send step field. Ensures smooth rollout without breaking existing provisioning jobs.

3. **Best-effort updates**: Step updates log warnings instead of throwing errors when job/instance not found. Prevents callback failures due to race conditions or out-of-order messages.

4. **Terminal state cleanup**: Clear `currentStep` when transitioning to "running" status to avoid stale step data in database.

## Integration Points

### Upstream Dependencies
- Phase 9: Lifecycle management (rollback on failure)
- Phase 8: Ansible configuration workflow
- Phase 7: VM provisioning and Tailscale setup

### Downstream Consumers
- Frontend provisioning status UI (src/components/dashboard/provisioning-status.tsx)
- Future: Phase 10 Plan 02 will add workflow step callbacks

### API Contracts

**GitHub Callback Payload (new field)**:
```typescript
{
  job_id: string;
  status?: "provisioning" | "running" | "failed";
  step?: string; // NEW: workflow step identifier
  ...
}
```

**Instance API Response (modified)**:
```typescript
{
  instance: {
    currentStep: string | null; // NEW
    ...
  },
  steps: ProvisioningStep[]; // NOW derived from currentStep
  ...
}
```

## Files Changed

### Created
- `drizzle/0004_fearless_the_liberteens.sql` - Migration for currentStep column
- `drizzle/meta/0004_snapshot.json` - Drizzle migration metadata

### Modified
- `src/lib/db/schema.ts` - Added currentStep column to agentInstances
- `src/lib/provisioning/queue.ts` - Added updateProvisioningStep(), clear currentStep on completion
- `src/lib/provisioning/index.ts` - Refactored getProvisioningSteps() with currentStep parameter
- `src/app/api/webhooks/github/route.ts` - Handle step field in callback payload
- `src/app/api/agents/[id]/instance/route.ts` - Pass currentStep to getProvisioningSteps()

## Next Steps

**Immediate**: Phase 10 Plan 02 will update the GitHub Actions workflow to send step callbacks during provisioning.

**Follow-up**:
- Monitor step update frequency in production (avoid excessive callbacks)
- Consider adding step timestamps for duration analytics
- Add step-specific error messages for better debugging

## Commits

- `98cd5fb` - feat(10-01): add currentStep tracking to agentInstances
- `da09240` - chore(10-01): add drizzle migration metadata
- `f1cecc3` - feat(10-01): wire step-aware provisioning progress pipeline

## Self-Check: PASSED

### Files Exist
```
✓ FOUND: src/lib/db/schema.ts (currentStep column)
✓ FOUND: src/lib/provisioning/queue.ts (updateProvisioningStep function)
✓ FOUND: src/lib/provisioning/index.ts (step-aware getProvisioningSteps)
✓ FOUND: src/app/api/webhooks/github/route.ts (step handling)
✓ FOUND: src/app/api/agents/[id]/instance/route.ts (currentStep passed)
✓ FOUND: drizzle/0004_fearless_the_liberteens.sql (migration)
```

### Commits Exist
```
✓ FOUND: 98cd5fb (feat: add currentStep tracking)
✓ FOUND: da09240 (chore: drizzle metadata)
✓ FOUND: f1cecc3 (feat: wire step pipeline)
```

### Verification Tests
```
✓ PASSED: Step derivation with vm_created
✓ PASSED: Step derivation with ansible_started
✓ PASSED: Backward compatibility (null currentStep)
✓ PASSED: Running status (all completed)
✓ PASSED: Failed status (error marking)
```
