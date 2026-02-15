---
phase: 07-vm-provisioning-via-hetzner-api
plan: 03
subsystem: provisioning-pipeline
tags: [callback-handler, database, vm-metadata, agent-lifecycle]
dependency_graph:
  requires: [06-03-github-callback-handler]
  provides: [vm-metadata-storage, agent-activation]
  affects: [agent-provisioning-workflow, agent-status-management]
tech_stack:
  added: []
  patterns: [callback-routing, conditional-branching, atomic-updates]
key_files:
  created: []
  modified:
    - src/lib/provisioning/queue.ts
    - src/app/api/webhooks/github/route.ts
decisions:
  - decision: "Update agent status to 'active' atomically with instance creation"
    rationale: "Agent should transition from 'draft' to 'active' when infrastructure is confirmed running"
    alternatives: ["Manual status update", "Separate API call"]
    selected: "Atomic update in completeProvisioningWithMetadata"
  - decision: "Support backward compatibility for status=running without metadata"
    rationale: "Allows gradual rollout and handles edge cases where metadata might be missing"
    alternatives: ["Require metadata always", "Fail if metadata missing"]
    selected: "Conditional routing based on metadata presence"
metrics:
  duration_seconds: 116
  tasks_completed: 2
  files_modified: 2
  commits: 2
  completed_at: "2026-02-13"
---

# Phase 07 Plan 03: VM Metadata Storage and Agent Activation Summary

**One-liner:** Extended callback handler to store VM metadata (server_id, server_ip, tailscale_ip) in agentInstances table and activate agents atomically on provisioning success.

## What Was Built

Created the complete data path from GitHub Actions workflow back to the application database. When the provisioning workflow successfully creates a VM and reports back with infrastructure details, the callback handler now:

1. **Stores VM metadata** - serverId, serverIp, and tailscaleIp are persisted in the agentInstances table
2. **Updates job status** - provisioning job marked as "running" with completedAt timestamp
3. **Activates agent** - agent status transitions from "draft" to "active"
4. **Maintains backward compatibility** - handles status updates both with and without metadata

### New Function: `completeProvisioningWithMetadata`

Added to `src/lib/provisioning/queue.ts`:
- Exported `VMMetadata` interface for type safety
- Atomically updates provisioning job, agent instance, and agent status
- Creates new agent instance if none exists
- Updates existing instance if one exists (handles retry scenarios)
- Logs complete metadata for debugging

### Extended Callback Handler

Modified `src/app/api/webhooks/github/route.ts`:
- Added VM metadata fields to payload type (server_id, server_ip, tailscale_ip)
- Conditional routing: status=running WITH metadata → completeProvisioningWithMetadata
- Conditional routing: status=running WITHOUT metadata → updateJobStatus (backward compatible)
- All existing callback types preserved (heartbeat, provisioning, failed)

## Tasks Completed

| Task | Name                                               | Commit  | Files Modified                        |
| ---- | -------------------------------------------------- | ------- | ------------------------------------- |
| 1    | Add completeProvisioningWithMetadata to queue      | 305ac99 | src/lib/provisioning/queue.ts         |
| 2    | Extend GitHub callback handler for VM metadata     | f68ac72 | src/app/api/webhooks/github/route.ts  |

## Technical Implementation

### Database Flow

```
GitHub Actions Callback (status=running + metadata)
  ↓
completeProvisioningWithMetadata()
  ↓
├── Update provisioningJobs.status → "running"
├── Check for existing agentInstances
├── Create/Update agentInstances with VM metadata
└── Update agents.status → "active"
```

### Type Safety

```typescript
export interface VMMetadata {
  serverId: string;    // Hetzner server ID
  serverIp: string;    // Public IPv4
  tailscaleIp: string; // Tailscale network IP
}
```

### Conditional Routing Logic

The callback handler implements smart routing:
- **Full path:** `status: "running"` + metadata present → complete provisioning + create instance + activate agent
- **Partial path:** `status: "running"` + metadata missing → only update job status
- **Existing paths:** heartbeat, provisioning, failed → unchanged

## Verification Results

All success criteria met:
- ✅ `npx tsc --noEmit` passes with zero errors
- ✅ Callback handler accepts VM metadata in payload
- ✅ `completeProvisioningWithMetadata` creates/updates agentInstances record
- ✅ Agent status updated to "active" on successful provisioning
- ✅ Backward compatible: status=running without metadata still works
- ✅ All existing callback handler behavior preserved

## Deviations from Plan

None - plan executed exactly as written.

## Files Modified

**src/lib/provisioning/queue.ts** (76 lines added)
- Added imports: `agentInstances`, `agents` from schema
- Exported `VMMetadata` interface
- Added `completeProvisioningWithMetadata` function with full implementation

**src/app/api/webhooks/github/route.ts** (+18 lines, -9 refactored)
- Added import: `completeProvisioningWithMetadata`
- Extended payload type with VM metadata fields
- Added conditional branching for metadata routing

## Dependencies

**Requires:**
- 06-03: GitHub Actions callback handler and webhook endpoint
- Database schema: agentInstances table with VM metadata columns
- Database schema: agents table with status field

**Provides:**
- VM metadata storage capability
- Agent activation on successful provisioning
- Complete provisioning data path

**Affects:**
- Agent status lifecycle (draft → active transition)
- Provisioning workflow completion handling
- Agent instance management

## Next Steps

This completes the callback handler side of the provisioning pipeline. The data path is now:

1. ✅ Stripe webhook → enqueue job (Phase 06-01)
2. ✅ Job triggers GitHub Actions (Phase 06-02)
3. ✅ GitHub Actions posts callbacks (Phase 06-03)
4. ✅ Callback stores VM metadata → activates agent (Phase 07-03) **← We are here**

Next phase work will implement the actual infrastructure provisioning in the GitHub Actions workflow (Hetzner API calls, Tailscale setup, cloud-init configuration).

## Self-Check: PASSED

**Created files verification:**
- ✅ FOUND: .planning/phases/07-vm-provisioning-via-hetzner-api/07-03-SUMMARY.md

**Modified files verification:**
- ✅ FOUND: src/lib/provisioning/queue.ts (exports completeProvisioningWithMetadata)
- ✅ FOUND: src/app/api/webhooks/github/route.ts (imports and uses completeProvisioningWithMetadata)

**Commits verification:**
- ✅ FOUND: 305ac99 (feat(07-03): add completeProvisioningWithMetadata to queue module)
- ✅ FOUND: f68ac72 (feat(07-03): extend GitHub callback handler for VM metadata)

All claimed artifacts exist and contain expected implementations.
