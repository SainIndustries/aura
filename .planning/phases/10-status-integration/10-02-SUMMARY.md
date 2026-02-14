---
phase: 10-status-integration
plan: 02
subsystem: provisioning-workflow
tags: [github-actions, callbacks, progress-tracking, observability]

dependency_graph:
  requires:
    - "10-01 (webhook handler expects step field in callbacks)"
    - "Phase 08 (Ansible integration in workflow)"
    - "Phase 07 (VM provisioning and HMAC signing pattern)"
  provides:
    - "Granular step callbacks (vm_created, ansible_started, ansible_complete)"
    - "Real-time progress data for dashboard 5-step visualization"
  affects:
    - ".github/workflows/provision-agent.yml (step callback injection points)"
    - "src/app/api/webhooks/github/route.ts (receives step data - from 10-01)"

tech_stack:
  added: []
  patterns:
    - "Fire-and-forget callbacks with || true for fault tolerance"
    - "HMAC SHA256 signing for webhook security (existing pattern extended)"
    - "jq for JSON construction (existing pattern)"

key_files:
  created: []
  modified:
    - ".github/workflows/provision-agent.yml"

decisions:
  - summary: "Three step callbacks inserted at strategic workflow milestones"
    rationale: "vm_created (after VM+Tailscale), ansible_started (before playbook), ansible_complete (after playbook) provide complete visibility into provisioning pipeline"
    alternatives: "More granular steps (Tailscale separate, per-role callbacks) - rejected for v1.1 simplicity"

  - summary: "ansible_started has no if: condition, others check step outcome"
    rationale: "If we reach ansible_started, all prior steps succeeded (sequential execution). vm_created and ansible_complete use if: to only fire on success."
    alternatives: "Add conditions to all steps - unnecessary given GitHub Actions sequential guarantees"

  - summary: "Failure callback now includes step field matching failed_step"
    rationale: "Enables getProvisioningSteps to show error on correct UI step"
    alternatives: "Separate step field vs failed_step - kept both for backward compatibility and clarity"

metrics:
  duration_seconds: 202
  tasks_completed: 1
  files_modified: 1
  commits: 1
  deviations: 0
  completed_date: "2026-02-14"
---

# Phase 10 Plan 02: Workflow Step Callbacks Summary

Injected granular step callbacks into GitHub Actions provisioning workflow to provide real-time 5-step progress data to dashboard via webhook handler.

## What Was Done

### Task 1: Add Granular Step Callbacks to Provisioning Workflow

**Objective:** Modify `.github/workflows/provision-agent.yml` to send step callbacks at each major provisioning milestone.

**Implementation:**

1. **vm_created callback** (after "Provision VM", before "Install Ansible")
   - Fires when `steps.provision.outcome == 'success'`
   - Sends `{job_id, status: "provisioning", step: "vm_created"}`
   - Maps to UI step 2 (Creating Server) completion
   - Indicates both Hetzner VM and Tailscale enrollment complete

2. **ansible_started callback** (after "Generate Ansible inventory", before "Configure VM with Ansible")
   - No condition - fires if reached (sequential execution guarantee)
   - Sends `{job_id, status: "provisioning", step: "ansible_started"}`
   - Maps to UI step 3 (Installing Dependencies) activation

3. **ansible_complete callback** (after "Configure VM with Ansible", before "Stop heartbeat")
   - Fires when `steps.configure.outcome == 'success'`
   - Sends `{job_id, status: "provisioning", step: "ansible_complete"}`
   - Maps to UI step 4 (Configuring Agent) completion

4. **Updated failure callback**
   - Added `--arg step "$FAILED_STEP"` and `step: $step` to JSON payload
   - Enables webhook handler to update currentStep on failure
   - Allows dashboard to show error on correct UI step

**Callback Pattern:**
```yaml
- name: Send <step> callback
  if: steps.<id>.outcome == 'success'  # conditional callbacks only
  run: |
    BODY=$(jq -n \
      --arg job_id "${{ inputs.job_id }}" \
      --arg status "provisioning" \
      --arg step "<step_name>" \
      '{job_id: $job_id, status: $status, step: $step}')
    SIGNATURE=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "${{ secrets.GITHUB_CALLBACK_SECRET }}" -hex | awk '{print $NF}')

    curl -sf -X POST "${{ inputs.callback_url }}" \
      -H "Content-Type: application/json" \
      -H "X-Signature: $SIGNATURE" \
      -d "$BODY" || true  # fire-and-forget

    echo "Sent <step_name> step callback for job ${{ inputs.job_id }}"
```

**Fire-and-Forget Design:**
- All step callbacks use `|| true` to make them non-blocking
- If callback endpoint is temporarily down, workflow continues
- Next callback or final success/failure callback catches up
- Critical for workflow reliability (infrastructure provisioning should not fail on telemetry)

## Full Callback Sequence

**Successful Provisioning:**
1. provisioning (no step) → Queued=complete, Creating Server=active
2. vm_created → Creating Server=complete, Installing Dependencies=active
3. ansible_started → Installing Dependencies=complete, Configuring Agent=active
4. ansible_complete → Configuring Agent=complete, Running=active
5. running (with metadata) → Running=complete (all done)

**Failure at Ansible:**
1. provisioning (no step) → Queued=complete, Creating Server=active
2. vm_created → Creating Server=complete, Installing Dependencies=active
3. ansible_started → Installing Dependencies=complete, Configuring Agent=active
4. failed (step=configure) → Configuring Agent=error

## Verification Results

All verification checks passed:

- `grep -c 'step'` → 29 occurrences (step callbacks + step conditions)
- `grep 'vm_created'` → Found vm_created callback
- `grep 'ansible_started'` → Found ansible_started callback
- `grep 'ansible_complete'` → Found ansible_complete callback
- `python3 -c "import yaml; yaml.safe_load(...)"` → YAML validation PASSED
- All step callbacks have `|| true` (fire-and-forget): lines 104, 150, 175
- Failure callback includes `--arg step "$FAILED_STEP"` and `step: $step` in payload

## Deviations from Plan

None - plan executed exactly as written.

## Integration Points

**Upstream (from):**
- Phase 10 Plan 01: Webhook handler expects `step` field in callback body, maps to currentStep in database
- Phase 08: Ansible integration provides `steps.configure` step ID for ansible_complete condition
- Phase 07: VM provisioning provides `steps.provision` step ID for vm_created condition, HMAC signing pattern

**Downstream (to):**
- Dashboard UI (`src/components/dashboard/provisioning-status.tsx`): getProvisioningSteps uses currentStep to show active/complete/error states
- Users see real-time 5-step progress visualization during agent provisioning

## What This Enables

**Before:**
- Dashboard showed generic "Provisioning..." status
- No visibility into which step was executing or where failures occurred
- Users couldn't tell if workflow was stuck or progressing

**After:**
- Dashboard shows detailed 5-step progress: Queued → Creating Server → Installing Dependencies → Configuring Agent → Running
- Real-time updates as each step completes
- Errors displayed on the correct step with descriptive messaging
- Complete provisioning observability without checking GitHub Actions logs

**Combined with Plan 01:**
- Full pipeline: GitHub Actions → webhook → database → API → dashboard
- Granular step tracking from infrastructure to UI
- Foundation for future enhancements (step timing, retry visualization, health checks)

## Testing Notes

**Automated:**
- YAML validation passed
- All callback patterns match existing HMAC signing convention
- Fire-and-forget pattern verified on all step callbacks

**Manual (deferred to E2E):**
- Trigger real provisioning workflow, observe step callbacks in network logs
- Verify dashboard updates in real-time as steps complete
- Test failure scenarios (provision failure, Ansible failure) show error on correct step
- Confirm callback endpoint downtime doesn't fail workflow

## Architecture Notes

**Why These Three Steps:**

1. **vm_created**: Marks completion of Hetzner server creation + Tailscale enrollment (both happen in provision-vm.ts). This is the "Creating Server" step completion.

2. **ansible_started**: Fires just before Ansible playbook runs. Indicates dependencies installation is about to begin. No condition needed because if we reach this step, VM creation succeeded.

3. **ansible_complete**: Marks successful Ansible playbook execution. This is the "Configuring Agent" step completion.

**Why Not More Steps:**
- No separate Tailscale step: happens inside provision-vm.ts, included in vm_created
- No separate dependency installation steps: Ansible roles are internal implementation details
- No heartbeat as step: heartbeat is background keepalive, not a milestone
- Balances granularity with simplicity for v1.1

## Files Modified

**`.github/workflows/provision-agent.yml`:**
- Added 3 step callback steps (52 lines)
- Updated failure callback to include step field (1 line)
- All callbacks use consistent HMAC signing pattern
- All step callbacks are fire-and-forget with || true

## Commits

- `02b378b`: feat(10-02): add granular step callbacks to provisioning workflow

## Self-Check: PASSED

**Created files:**
- `.planning/phases/10-status-integration/10-02-SUMMARY.md` → FOUND

**Modified files:**
- `.github/workflows/provision-agent.yml` → FOUND (git status confirms)

**Commits:**
- `02b378b` → FOUND: feat(10-02): add granular step callbacks to provisioning workflow

**Callback verification:**
- vm_created callback → FOUND at line 91-106
- ansible_started callback → FOUND at line ~135-150
- ansible_complete callback → FOUND at line ~160-175
- step field in failure callback → FOUND

All claims verified. Summary is accurate.
