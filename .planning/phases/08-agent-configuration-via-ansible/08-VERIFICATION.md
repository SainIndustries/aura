---
phase: 08-agent-configuration-via-ansible
verified: 2026-02-13T23:15:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "Workflow execution end-to-end"
    expected: "GitHub Actions workflow successfully provisions VM, configures it with Ansible, and reports success"
    why_human: "Requires live GitHub Actions run with Hetzner and Tailscale API access"
  - test: "SSH connection via Tailscale"
    expected: "GitHub Actions runner successfully connects to VM via Tailscale IP and executes Ansible playbook"
    why_human: "Requires live Tailscale network enrollment and SSH key validation"
  - test: "Cloud-init readiness timing"
    expected: "Playbook waits for cloud-init completion before proceeding with configuration"
    why_human: "Requires observing timing on fresh VM (cloud-init can take 2-5 minutes)"
  - test: "Service persistence after reboot"
    expected: "Agent service (though failing due to missing binary) remains enabled after VM reboot"
    why_human: "Requires VM reboot to verify systemd persistence"
---

# Phase 08: Agent Configuration via Ansible Verification Report

**Phase Goal:** Configure VMs with openclaw-ansible adapted for remote execution
**Verified:** 2026-02-13T23:15:00Z
**Status:** human_needed
**Re-verification:** No (initial verification)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Ansible playbook targets remote hosts via SSH (not localhost) | ✓ VERIFIED | `hosts: all` on line 3, no `connection: local` found (grep count: 0) |
| 2 | Playbook waits for cloud-init completion before running configuration tasks | ✓ VERIFIED | `wait_for_connection` (lines 14-18) and `cloud_init_data_facts` (lines 21-29) with retry logic (60 retries, 10s delay) |
| 3 | GitHub Actions runner joins Tailscale network before running Ansible | ✓ VERIFIED | `tailscale/github-action@v3` step on line 42, runs before Ansible playbook execution |
| 4 | Ansible installs Docker, systemd services, and agent runtime on VM | ✓ VERIFIED | Docker installation (lines 56-71), Node.js 20 (lines 73-86), systemd service (lines 121-147), UFW/fail2ban (lines 162-212) |
| 5 | Agent service starts automatically and is enabled for boot persistence | ✓ VERIFIED | Service enabled with `enabled: yes` (line 153), `failed_when: false` allows start failure (line 156) until agent binary deployed |
| 6 | SSH key is securely injected and cleaned up after workflow completes | ✓ VERIFIED | SSH key written with `chmod 600` (line 103), cleanup with `if: always()` (lines 137-141) ensures removal even on failure |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/ansible/playbooks/configure-agent.yml` | Ansible playbook adapted for remote VM configuration | ✓ VERIFIED | 252 lines, targets `hosts: all`, includes wait_for_connection, cloud_init_data_facts, Docker/Node.js installation, systemd service, security hardening |
| `src/ansible/requirements.yml` | Ansible Galaxy collection dependencies | ✓ VERIFIED | 3 lines, specifies `community.general >=5.0.0` for cloud_init_data_facts module |
| `.github/workflows/provision-agent.yml` | Extended workflow with Tailscale runner setup and Ansible execution | ✓ VERIFIED | 185 lines, includes Tailscale setup (line 41), Ansible installation (line 91), collection install (line 96), dynamic inventory (lines 105-119), playbook execution (lines 121-127), SSH cleanup (lines 137-141) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `.github/workflows/provision-agent.yml` | `src/ansible/playbooks/configure-agent.yml` | `ansible-playbook` command in workflow step | ✓ WIRED | Line 124: `ansible-playbook src/ansible/playbooks/configure-agent.yml` |
| `.github/workflows/provision-agent.yml` | `src/ansible/requirements.yml` | `ansible-galaxy collection install` | ✓ WIRED | Line 97: `ansible-galaxy collection install -r src/ansible/requirements.yml` |
| `src/ansible/playbooks/configure-agent.yml` | `steps.provision.outputs.tailscale_ip` | Dynamic inventory generated in workflow | ✓ WIRED | Line 111: `ansible_host: ${{ steps.provision.outputs.tailscale_ip }}` |

### Requirements Coverage

| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| PROV-02: Ansible configuration for VMs | ✓ SATISFIED | All supporting truths verified |

### Anti-Patterns Found

No blocker anti-patterns detected.

**Notable design decisions (not anti-patterns):**

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/ansible/playbooks/configure-agent.yml` | 134 | ExecStart points to non-existent `/opt/openclaw/agent/index.js` | ℹ️ Info | Intentional placeholder - agent binary deployed in Phase 9. Service enabled but start allowed to fail. |
| `src/ansible/playbooks/configure-agent.yml` | 114 | Hardcoded API URL `https://api.aura.example.com` | ℹ️ Info | Example placeholder - should be parameterized in production. |
| `.github/workflows/provision-agent.yml` | 46 | Tailscale tag `tag:ci` requires ACL configuration | ℹ️ Info | User must configure Tailscale ACLs or remove tag parameter. Documented in SUMMARY. |

### Human Verification Required

#### 1. Workflow Execution End-to-End

**Test:** Trigger GitHub Actions workflow with valid inputs (job_id, agent_id, region, callback_url) and all required secrets configured (HETZNER_API_TOKEN, HETZNER_SSH_KEY_ID, HETZNER_SSH_PRIVATE_KEY, TAILSCALE_OAUTH_CLIENT_ID, TAILSCALE_OAUTH_CLIENT_SECRET, GITHUB_CALLBACK_SECRET)

**Expected:** 
- Workflow completes successfully within 25 minutes
- VM is provisioned via Hetzner API
- GitHub Actions runner joins Tailscale network
- Ansible playbook executes against VM via Tailscale IP
- Docker, Node.js 20, and systemd service are installed
- UFW and fail2ban are enabled
- Success callback is sent with VM metadata
- SSH key is cleaned up

**Why human:** Requires live API access to Hetzner and Tailscale, GitHub Secrets configuration, and observing real-time workflow execution. Cannot simulate multi-service orchestration.

#### 2. SSH Connection via Tailscale

**Test:** Observe GitHub Actions runner logs during "Configure VM with Ansible" step for successful SSH connection to VM Tailscale IP

**Expected:**
- Ansible connects to VM via Tailscale IP (not public IP)
- SSH host key is accepted with StrictHostKeyChecking=accept-new
- No SSH connection timeout or authentication errors
- Ansible playbook tasks execute successfully

**Why human:** Requires observing live SSH connection establishment and Tailscale network routing. Cannot verify network connectivity without live infrastructure.

#### 3. Cloud-init Readiness Timing

**Test:** Observe Ansible playbook execution on fresh VM, specifically the "Wait for cloud-init to complete" task timing

**Expected:**
- Task retries until cloud_init_data_facts.status.v1.stage == '' (empty string indicates completion)
- Retry count < 60 (completes within 10 minutes)
- Tailscale verification succeeds (cloud-init installed Tailscale successfully)
- No apt lock errors during package installation (cloud-init completed before apt tasks)

**Why human:** Requires observing timing on fresh VM. Cloud-init completion time varies (2-5 minutes) and depends on Hetzner VM boot speed and Tailscale enrollment.

#### 4. Service Persistence After Reboot

**Test:** SSH to VM, verify openclaw-agent service status, reboot VM, reconnect, verify service remains enabled

```bash
# Before reboot
systemctl status openclaw-agent
systemctl is-enabled openclaw-agent

# Reboot
sudo reboot

# After reboot (wait 1-2 minutes)
systemctl status openclaw-agent
systemctl is-enabled openclaw-agent
```

**Expected:**
- Before reboot: service is `enabled` (systemctl is-enabled returns "enabled")
- Before reboot: service is `failed` or `inactive` (agent binary doesn't exist yet)
- After reboot: service remains `enabled`
- After reboot: service attempts to start but fails gracefully (logged in journal)

**Why human:** Requires VM reboot to verify systemd persistence. Cannot simulate systemd boot sequence programmatically.

### Automated Verification Summary

**All automated checks passed:**
- ✓ All artifacts exist and are substantive (not stubs)
- ✓ All key links are wired correctly
- ✓ Playbook targets remote hosts via SSH (not localhost)
- ✓ Cloud-init readiness checks implemented
- ✓ Docker and Node.js installation tasks present
- ✓ Systemd service configuration complete
- ✓ Security hardening (UFW, fail2ban) included
- ✓ SSH key cleanup with `if: always()` ensures security
- ✓ Workflow timeout increased to 25 minutes
- ✓ Failure callback correctly attributes provision vs configure failures
- ✓ Commits verified (75a55a4, a7ac3a8)

**Intentional design choices verified:**
- ✓ Agent service enabled but allowed to fail (agent binary deployed in Phase 9)
- ✓ Dynamic inventory generated from VM provisioning outputs
- ✓ Tailscale runner enrollment uses OAuth client from Phase 7
- ✓ StrictHostKeyChecking=accept-new for fresh VMs (safer than no checking)

---

_Verified: 2026-02-13T23:15:00Z_
_Verifier: Claude (gsd-verifier)_
