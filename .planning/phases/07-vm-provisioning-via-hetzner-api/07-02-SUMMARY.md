---
phase: 07-vm-provisioning-via-hetzner-api
plan: 02
subsystem: infra
tags: [hetzner, tailscale, cloud-init, github-actions, vm-provisioning, tsx]

# Dependency graph
requires:
  - phase: 07-01
    provides: Hetzner, Tailscale, and cloud-init API client modules
provides:
  - VM provisioning orchestrator that coordinates server creation with Tailscale networking
  - GitHub Actions workflow executes real infrastructure creation (replaces placeholder)
  - VM metadata (server_id, server_ip, tailscale_ip) sent to callback webhook
affects: [08-ansible-configuration, 09-vm-lifecycle, production-deployment]

# Tech tracking
tech-stack:
  added: [tsx, jq]
  patterns:
    - CLI entry point pattern with GITHUB_OUTPUT for Actions integration
    - Region mapping from user-friendly names to provider-specific locations
    - Ephemeral auth key generation per VM provision
    - Step output capture for workflow metadata propagation

key-files:
  created:
    - src/lib/provisioning/provision-vm.ts
  modified:
    - .github/workflows/provision-agent.yml

key-decisions:
  - "Use relative imports (../hetzner, ../tailscale, ../cloud-init) in provision-vm.ts for reliable standalone execution in GitHub Actions"
  - "Region-to-location mapping with nbg1 as default when region not in predefined map"
  - "Server naming pattern: agent-{agentId first 8 chars}-{timestamp} for uniqueness and traceability"
  - "Use jq for JSON construction in workflow callbacks to avoid escaping issues"
  - "Node.js 20 with npm ci ensures TypeScript execution works in Actions environment"

patterns-established:
  - "CLI entry point pattern: dual-mode modules export function + have CLI main() with GITHUB_OUTPUT support"
  - "Orchestrator pattern: single high-level function coordinates multiple API clients with detailed logging"
  - "GitHub Actions metadata flow: script outputs → step outputs → callback webhook"

# Metrics
duration: 115s
completed: 2026-02-13
---

# Phase 07 Plan 02: VM Provisioning Orchestrator Summary

**Real Hetzner VM provisioning with Tailscale networking via TypeScript orchestrator executed in GitHub Actions workflow**

## Performance

- **Duration:** 1m 55s
- **Started:** 2026-02-13T21:53:53Z
- **Completed:** 2026-02-13T21:55:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created VM provisioning orchestrator that coordinates Hetzner server creation, Tailscale enrollment, and cloud-init configuration
- Replaced GitHub Actions workflow placeholder with real infrastructure provisioning via npx tsx execution
- Success callback now includes complete VM metadata (server_id, server_ip, tailscale_ip) for agent activation
- Established CLI entry point pattern for GitHub Actions integration with GITHUB_OUTPUT support

## Task Commits

Each task was committed atomically:

1. **Task 1: Create VM provisioning orchestrator script** - `7faf41e` (feat)
2. **Task 2: Replace workflow placeholder with real provisioning** - `d9cb695` (feat)

## Files Created/Modified

- `src/lib/provisioning/provision-vm.ts` - Orchestrator that coordinates Hetzner server creation, Tailscale auth key generation, cloud-init config, and enrollment verification. Exports provisionVM function and includes CLI entry point for GitHub Actions execution.
- `.github/workflows/provision-agent.yml` - Real provisioning workflow with Node.js 20 setup, npm ci for dependencies, npx tsx execution of provision-vm.ts, and jq-based JSON construction for callbacks with VM metadata.

## Decisions Made

- **Relative imports in provision-vm.ts:** Used `../hetzner`, `../tailscale`, `../cloud-init` instead of `@/lib/*` aliases since this script runs standalone in GitHub Actions where path aliases may not resolve reliably with tsx
- **Region mapping strategy:** Created simple mapping object with nbg1 (Nuremberg, Germany) as default fallback for unmapped regions, avoiding hard errors for typos or new regions
- **Server naming convention:** `agent-{agentId.slice(0,8)}-{Date.now()}` provides uniqueness via timestamp while keeping agent traceability via ID prefix
- **jq for callback JSON:** Replaced string interpolation with `jq -n` for robust JSON construction, eliminating escaping issues with special characters in metadata values
- **Node.js 20 in workflow:** Added setup-node@v4 with Node 20 and npm ci to ensure TypeScript execution environment is properly configured before running tsx

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed without issues. TypeScript compilation passed, workflow YAML is valid, all verification checks passed.

## User Setup Required

**External services require secrets configuration.** The following GitHub Actions secrets must be configured before workflow can execute successfully:

### Required Secrets

- `HETZNER_API_TOKEN` - Hetzner Cloud API token for server creation
- `HETZNER_SSH_KEY_ID` - Numeric ID of SSH key pre-uploaded to Hetzner Cloud (used for VM access)
- `TAILSCALE_OAUTH_CLIENT_ID` - Tailscale OAuth client ID for ephemeral auth key generation
- `TAILSCALE_OAUTH_CLIENT_SECRET` - Tailscale OAuth client secret
- `GITHUB_CALLBACK_SECRET` - HMAC secret for signing callback webhooks

### Verification

After secrets are configured, the workflow can be tested via:
1. Dispatch workflow with test inputs (job_id, agent_id, region, callback_url)
2. Check workflow run logs for successful VM creation
3. Verify callback webhook receives VM metadata (server_id, server_ip, tailscale_ip)

## Next Phase Readiness

- **Ready for Phase 8:** Ansible configuration playbook adaptation
- **VM provisioning working:** Hetzner server created, Tailscale enrolled, metadata returned
- **Workflow integration complete:** GitHub Actions workflow executes real infrastructure creation, success/failure callbacks work
- **Metadata propagation established:** VM details (server_id, server_ip, tailscale_ip) flow from provision script → workflow outputs → callback webhook → application database (via 07-03)

**Potential concerns:**
- SSH key must be pre-uploaded to Hetzner Cloud and ID added to secrets before first run
- Tailscale OAuth client must be created in Tailscale admin console before first run
- Workflow timeout is 15 minutes - sufficient for provisioning but may need adjustment if Tailscale enrollment is slow in some regions

## Self-Check: PASSED

All claims verified:
- File created: src/lib/provisioning/provision-vm.ts ✓
- Commit 7faf41e exists ✓
- Commit d9cb695 exists ✓

---
*Phase: 07-vm-provisioning-via-hetzner-api*
*Completed: 2026-02-13*
