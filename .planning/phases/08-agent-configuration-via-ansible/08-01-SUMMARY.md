---
phase: 08-agent-configuration-via-ansible
plan: 01
subsystem: infra
tags: [ansible, docker, nodejs, systemd, tailscale, ufw, fail2ban, github-actions]

# Dependency graph
requires:
  - phase: 07-vm-provisioning-via-hetzner-api
    provides: VM provisioning with Tailscale enrollment via cloud-init
provides:
  - Ansible playbook for remote VM configuration via SSH
  - GitHub Actions workflow integration with Tailscale runner
  - Docker and Node.js 20 installation on remote VMs
  - systemd service configuration for OpenClaw agent
  - Security hardening (UFW firewall, fail2ban)
affects: [09-agent-deployment, 10-monitoring]

# Tech tracking
tech-stack:
  added: [ansible-core, community.general, tailscale/github-action@v3]
  patterns: [remote configuration via Ansible, dynamic inventory generation, cloud-init readiness checks]

key-files:
  created:
    - src/ansible/playbooks/configure-agent.yml
    - src/ansible/requirements.yml
  modified:
    - .github/workflows/provision-agent.yml

key-decisions:
  - "Use apt for Ansible installation in GitHub Actions instead of pipx (faster, sufficient for CI)"
  - "Use Tailscale GitHub Action v3 to join runner to Tailnet for SSH access to VMs"
  - "Generate dynamic Ansible inventory in workflow from VM provisioning outputs"
  - "Accept new SSH host keys with StrictHostKeyChecking=accept-new (fresh VMs)"
  - "Set agent service to enabled but allow start to fail (agent binary deployed in later phase)"
  - "Use single SSH key from GitHub Secrets for all VMs (per-agent keys deferred to Phase 11)"

patterns-established:
  - "Pattern: Multi-stage VM readiness check (wait_for_connection + cloud_init_data_facts)"
  - "Pattern: Ephemeral Tailscale enrollment for GitHub Actions runners"
  - "Pattern: Dynamic inventory generation from provisioning metadata"
  - "Pattern: SSH key cleanup with if: always() for security"

# Metrics
duration: 147s
completed: 2026-02-13
---

# Phase 08 Plan 01: Agent Configuration via Ansible Summary

**Ansible playbook configures remote Hetzner VMs with Docker, Node.js 20, systemd agent service, and security hardening via GitHub Actions workflow with Tailscale runner**

## Performance

- **Duration:** 2 min 27 sec (147 seconds)
- **Started:** 2026-02-13T22:30:24Z
- **Completed:** 2026-02-13T22:32:51Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created Ansible playbook targeting remote hosts via SSH (not localhost) with cloud-init readiness checks
- Extended GitHub Actions workflow with Tailscale runner enrollment and Ansible execution steps
- Implemented multi-stage VM configuration (Docker, Node.js, systemd, security hardening)
- Established dynamic inventory generation pattern from VM provisioning outputs
- Added SSH key management with proper permissions and cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Ansible playbook and Galaxy requirements for remote VM configuration** - `75a55a4` (feat)
2. **Task 2: Extend GitHub Actions workflow with Tailscale runner and Ansible execution** - `a7ac3a8` (feat)

## Files Created/Modified

### Created
- `src/ansible/playbooks/configure-agent.yml` - Ansible playbook for remote VM configuration with cloud-init wait, Docker/Node.js installation, systemd service setup, and security hardening
- `src/ansible/requirements.yml` - Ansible Galaxy collection dependencies (community.general for cloud_init_data_facts module)

### Modified
- `.github/workflows/provision-agent.yml` - Extended workflow with Tailscale runner enrollment, Ansible installation, dynamic inventory generation, playbook execution, and enhanced failure detection

## Decisions Made

### Ansible Installation Method
**Decision:** Use apt for Ansible installation in GitHub Actions instead of pipx
**Rationale:** Faster installation, sufficient for CI environment, Ubuntu runners already have Python 3

### Tailscale Runner Access
**Decision:** Use tailscale/github-action@v3 to join GitHub Actions runner to Tailnet
**Rationale:** Required for SSH access to VM Tailscale IPs (VMs not exposed on public internet), ephemeral enrollment with OAuth client

### Dynamic Inventory Generation
**Decision:** Generate Ansible inventory YAML dynamically in workflow from VM metadata
**Rationale:** Single-use inventory per provisioning job, avoids stale IP issues, uses fresh provisioning outputs (tailscale_ip, server_name, server_id)

### SSH Host Key Handling
**Decision:** Use StrictHostKeyChecking=accept-new for fresh VMs
**Rationale:** Fresh VMs have unknown host keys; accept-new safer than no checking (rejects changed keys, accepts new), sufficient for Tailscale private network

### Agent Service Behavior
**Decision:** Enable agent service but allow start to fail with failed_when: false
**Rationale:** Agent binary (/opt/openclaw/agent/index.js) doesn't exist yet (deployed in later phase), service unit needs to exist and be enabled for boot persistence, actual service start deferred to Phase 9

### SSH Key Management
**Decision:** Single platform SSH key from GitHub Secrets for all VMs
**Rationale:** Simpler for Phase 8 MVP, per-agent key rotation deferred to Phase 11 security hardening milestone

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed as specified with all verifications passing.

## User Setup Required

**External services require manual configuration.** The workflow references the following GitHub Secrets that must be configured:

### Required Secrets (Configured in Phase 7)
- `HETZNER_SSH_PRIVATE_KEY` - **NEW** - Private SSH key corresponding to HETZNER_SSH_KEY_ID uploaded in Phase 7
  - **Source:** Export from local SSH key or generate new pair and upload public key to Hetzner Cloud Console -> Security -> SSH Keys
  - **Why:** Ansible needs SSH access to VMs for remote configuration
  - **Verification:** `ssh -i /path/to/key root@<tailscale_ip>` should connect

### Existing Secrets (Reused)
- `TAILSCALE_OAUTH_CLIENT_ID` - Already configured in Phase 7
- `TAILSCALE_OAUTH_CLIENT_SECRET` - Already configured in Phase 7
- `GITHUB_CALLBACK_SECRET` - Already configured in Phase 6

### Tailscale ACL Configuration
The workflow uses `tags: tag:ci` for runner enrollment. Ensure Tailscale ACL allows tag:ci or use empty tags if ACLs are permissive.

## Next Phase Readiness

### Ready
- VM provisioning pipeline now includes full configuration (Phase 7 creates VM, Phase 8 configures it)
- Systemd service unit exists and is enabled for agent runtime
- Docker and Node.js 20 installed on VMs for agent execution
- Security hardening in place (UFW, fail2ban)
- Workflow detects provision vs configure failures for better debugging

### Blockers/Concerns
- Agent service won't actually run until agent binary deployed (Phase 9)
- HETZNER_SSH_PRIVATE_KEY secret must be added manually before workflow can execute Ansible playbook
- Tailscale tag:ci must be allowed in ACLs or tags parameter removed from workflow

### Next Phase
Phase 9 should focus on agent deployment (building/packaging agent binary, deploying to /opt/openclaw/agent/, starting the service).

## Self-Check: PASSED

All files and commits verified:
- src/ansible/playbooks/configure-agent.yml: FOUND
- src/ansible/requirements.yml: FOUND
- .github/workflows/provision-agent.yml: FOUND
- Commit 75a55a4: FOUND
- Commit a7ac3a8: FOUND

---
*Phase: 08-agent-configuration-via-ansible*
*Completed: 2026-02-13*
