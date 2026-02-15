# Phase 08: Agent Configuration via Ansible - Research

**Researched:** 2026-02-13
**Domain:** Ansible remote execution, openclaw-ansible adaptation, GitHub Actions integration
**Confidence:** HIGH

## Summary

This phase adapts the openclaw-ansible playbook (designed for localhost execution) to configure remote Hetzner VMs provisioned in Phase 7. The playbook installs Docker, Node.js, Tailscale, security hardening (UFW, Fail2ban), and systemd services for the OpenClaw agent runtime. Execution happens in GitHub Actions with SSH key authentication and dynamic inventory targeting fresh VMs.

**Critical Challenge:** openclaw-ansible assumes localhost execution (using `--ask-become-pass` and direct sudo). Adaptation requires: (1) creating an Ansible inventory with remote host SSH details, (2) replacing localhost connection with SSH transport, (3) handling cloud-init timing to ensure VM is fully initialized before playbook runs, (4) configuring passwordless sudo or SSH-based privilege escalation for GitHub Actions runner.

**Primary recommendation:** Create a minimal static inventory file generated dynamically in GitHub Actions workflow using VM metadata from Phase 7 (server_ip, tailscale_ip). Use `wait_for_connection` + `cloud_init_data_facts` modules to ensure VM readiness. Execute playbook with `--extra-vars` to pass agent-specific configuration. Store SSH private key in GitHub Secrets and write to runner filesystem with proper permissions (chmod 600) before execution.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Ansible Core | 2.20+ | Configuration management automation | Latest stable (Nov 2025), improved connection stability, Python 3.12-3.14 support |
| openclaw-ansible | Latest | Hardened OpenClaw agent deployment | Official OpenClaw playbook, 4-layer security, systemd integration, Docker sandboxing |
| hetzner.hcloud collection | Latest | Hetzner Cloud dynamic inventory (optional) | Official Ansible collection for Hetzner, simplifies multi-VM management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ansible.builtin.wait_for_connection | Built-in | Wait for SSH availability after VM boot | Required - fresh VMs may not have SSH ready immediately |
| community.general.cloud_init_data_facts | Latest | Verify cloud-init completion before configuration | Required - prevents race conditions with cloud-init scripts from Phase 7 |
| ansible.builtin.systemd_service | Built-in | Manage systemd units (agent service) | Core requirement - OpenClaw runs as systemd service |
| dawidd6/action-ansible-playbook | v1.2.0+ | GitHub Actions wrapper for Ansible | Recommended - handles SSH key normalization, automatic ansible-galaxy install |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Static inventory (dynamic generation) | hetzner.hcloud dynamic inventory | Dynamic inventory better for multi-VM fleets (>10 agents), overkill for Phase 8 MVP with single-VM-at-a-time provisioning |
| GitHub Actions SSH key secret | Ansible Vault encrypted vars | Vault adds complexity; GitHub Secrets sufficient for Phase 8 (single SSH key), use Vault when rotating per-agent keys |
| wait_for_connection module | Custom polling script | Built-in module is idempotent, tested, handles retries automatically |
| openclaw-ansible (adapt) | Write custom playbook from scratch | Don't reinvent - openclaw-ansible has 4-layer security, tested UFW rules, Tailscale integration |

**Installation:**
```bash
# On GitHub Actions runner (automatically installed by action)
ansible-galaxy collection install community.general
ansible-galaxy collection install hetzner.hcloud  # Optional for dynamic inventory

# Local development (pipx recommended for 2026)
pipx install ansible-core
```

## Architecture Patterns

### Recommended Project Structure
```
.github/
├── workflows/
│   └── provision-agent.yml       # Existing - add Ansible step after VM creation
src/
├── ansible/
│   ├── inventory/
│   │   └── hosts.yml.template    # Template for dynamic inventory generation
│   ├── playbooks/
│   │   └── configure-agent.yml   # Main playbook (imports openclaw-ansible role)
│   └── roles/
│       └── openclaw/             # Git submodule or vendored openclaw-ansible
└── lib/
    └── provisioning/
        ├── provision-vm.ts       # Existing - outputs VM metadata
        └── generate-inventory.ts # NEW - creates Ansible inventory from VM metadata
```

### Pattern 1: Dynamic Inventory Generation in GitHub Actions
**What:** Generate Ansible inventory YAML dynamically using VM metadata from Phase 7
**When to use:** Every provisioning run - inventory is ephemeral, not committed to repo
**Example:**
```yaml
# .github/workflows/provision-agent.yml
- name: Generate Ansible Inventory
  run: |
    cat > inventory.yml <<EOF
    all:
      hosts:
        agent_vm:
          ansible_host: ${{ steps.provision.outputs.tailscale_ip }}
          ansible_user: root
          ansible_ssh_private_key_file: /tmp/ssh_key
          ansible_python_interpreter: /usr/bin/python3
      vars:
        agent_id: ${{ inputs.agent_id }}
        server_name: ${{ steps.provision.outputs.server_name }}
    EOF

- name: Run Ansible Playbook
  uses: dawidd6/action-ansible-playbook@v2
  with:
    playbook: src/ansible/playbooks/configure-agent.yml
    inventory: inventory.yml
    key: ${{ secrets.HETZNER_SSH_PRIVATE_KEY }}
    options: |
      --verbose
      --extra-vars "agent_id=${{ inputs.agent_id }}"
```

**Why this works:**
- Tailscale IP (not public IP) used for secure internal-only access
- SSH key written to runner filesystem with proper permissions by action
- Inventory is single-use, generated fresh for each provisioning job
- `ansible_python_interpreter` set explicitly (Ubuntu 22.04 has python3 by default)

### Pattern 2: Wait for VM Readiness Before Configuration
**What:** Multi-stage readiness check - SSH availability + cloud-init completion
**When to use:** First task in every playbook targeting fresh VMs
**Example:**
```yaml
# src/ansible/playbooks/configure-agent.yml
- name: Configure OpenClaw Agent
  hosts: all
  become: yes
  gather_facts: no

  tasks:
    # Stage 1: Wait for SSH connection (max 5 minutes)
    - name: Wait for system to be reachable via SSH
      ansible.builtin.wait_for_connection:
        delay: 10              # Wait 10s before first attempt
        timeout: 300           # 5-minute total timeout
        sleep: 5               # Poll every 5 seconds
      retries: 3
      register: connection_result

    # Stage 2: Wait for cloud-init completion (max 10 minutes)
    - name: Wait for cloud-init to finish
      community.general.cloud_init_data_facts:
      register: cloud_init_status
      until: >
        cloud_init_status.cloud_init_data_facts is defined and
        cloud_init_status.cloud_init_data_facts.status.v1.stage is defined and
        cloud_init_status.cloud_init_data_facts.status.v1.stage == ''
      retries: 60            # 60 attempts
      delay: 10              # 10 seconds between attempts = 10 min max

    # Stage 3: Gather facts after VM is ready
    - name: Gather system facts
      ansible.builtin.setup:

    # Now safe to run openclaw-ansible tasks
    - name: Import openclaw-ansible role
      import_role:
        name: openclaw
```

**Why this matters:**
- Cloud-init from Phase 7 installs Tailscale, syncs NTP - must complete before Ansible runs
- Race condition: SSH may be available but cloud-init still installing packages
- `stage == ''` means cloud-init finished all stages (no stage currently running)
- `gather_facts: no` initially prevents failed fact gathering on unready VM

### Pattern 3: Adapting openclaw-ansible for Remote Execution
**What:** Minimal modifications to openclaw-ansible playbook for SSH-based remote execution
**When to use:** When vendoring/forking openclaw-ansible into this project
**Example:**
```yaml
# Original openclaw-ansible playbook.yml (localhost):
- name: Install OpenClaw
  hosts: localhost
  connection: local
  become: yes
  roles:
    - openclaw

# Adapted for remote execution:
- name: Install OpenClaw
  hosts: all                    # Changed from localhost
  # Removed: connection: local  # Use default SSH connection
  become: yes
  # Add: become_method defaults to sudo (works with root user)
  roles:
    - openclaw
```

**Key changes:**
- `hosts: localhost` → `hosts: all` (targets inventory hosts)
- Remove `connection: local` directive (defaults to SSH)
- `become: yes` still works (assumes root user or passwordless sudo)
- `--ask-become-pass` removed from CLI invocation (use SSH key authentication)

**No changes needed in role tasks:**
- UFW, Docker, systemd tasks work identically on remote vs local
- Tailscale already installed by cloud-init (Phase 7), playbook can skip or verify
- Role variables passed via `--extra-vars` from GitHub Actions

### Pattern 4: SSH Key Management in GitHub Actions
**What:** Securely inject SSH private key into ephemeral runner for Ansible
**When to use:** Required for every Ansible playbook execution in CI/CD
**Example:**
```yaml
# Manual approach (if not using dawidd6/action-ansible-playbook):
- name: Configure SSH Key
  run: |
    mkdir -p ~/.ssh
    echo "${{ secrets.HETZNER_SSH_PRIVATE_KEY }}" > ~/.ssh/id_rsa
    chmod 600 ~/.ssh/id_rsa
    chmod 700 ~/.ssh

    # Add Tailscale IP to known_hosts (or disable host key checking)
    ssh-keyscan -H ${{ steps.provision.outputs.tailscale_ip }} >> ~/.ssh/known_hosts

# Recommended approach (action handles this automatically):
- name: Run Ansible Playbook
  uses: dawidd6/action-ansible-playbook@v2
  with:
    playbook: configure-agent.yml
    inventory: inventory.yml
    key: ${{ secrets.HETZNER_SSH_PRIVATE_KEY }}
    options: |
      --ssh-common-args='-o StrictHostKeyChecking=accept-new'
```

**Security notes:**
- Private key never leaves GitHub Secrets encrypted storage except in runner memory
- Runner is ephemeral (destroyed after workflow completes)
- Use `accept-new` for first-time SSH to fresh VMs (avoids MITM for known-good IPs)
- Alternative: Pre-populate known_hosts with Tailscale fingerprints (more secure, more complex)

### Pattern 5: Passing Agent-Specific Variables to Playbook
**What:** Inject runtime configuration (agent_id, API keys, region) via extra-vars
**When to use:** Every playbook run - configuration differs per agent
**Example:**
```yaml
# GitHub Actions workflow:
- name: Run Ansible Configuration
  uses: dawidd6/action-ansible-playbook@v2
  with:
    playbook: src/ansible/playbooks/configure-agent.yml
    inventory: inventory.yml
    key: ${{ secrets.HETZNER_SSH_PRIVATE_KEY }}
    options: |
      --extra-vars '{"agent_id":"${{ inputs.agent_id }}","server_name":"${{ steps.provision.outputs.server_name }}","openclaw_version":"latest"}'

# Alternative: JSON file from provisioning metadata
- name: Create vars file
  run: |
    cat > agent_vars.json <<EOF
    {
      "agent_id": "${{ inputs.agent_id }}",
      "server_name": "${{ steps.provision.outputs.server_name }}",
      "openclaw_api_url": "https://api.aura.example.com",
      "openclaw_token": "${{ secrets.OPENCLAW_API_TOKEN }}"
    }
    EOF

- name: Run Ansible with vars file
  uses: dawidd6/action-ansible-playbook@v2
  with:
    playbook: configure-agent.yml
    inventory: inventory.yml
    key: ${{ secrets.HETZNER_SSH_PRIVATE_KEY }}
    options: |
      --extra-vars "@agent_vars.json"
```

**Usage in playbook:**
```yaml
# src/ansible/playbooks/configure-agent.yml
- name: Configure agent service
  ansible.builtin.template:
    src: openclaw.service.j2
    dest: /etc/systemd/system/openclaw-{{ agent_id }}.service
  vars:
    api_url: "{{ openclaw_api_url }}"
    auth_token: "{{ openclaw_token }}"
```

**Variable precedence:** extra-vars have highest priority, override all other sources

### Anti-Patterns to Avoid
- **Don't use public IP for Ansible SSH**: Always use Tailscale IP (security isolation, no exposed SSH port)
- **Don't skip cloud-init verification**: Ansible playbook will fail if cloud-init still installing packages/configuring network
- **Don't commit inventory files**: Generate dynamically from VM metadata; static inventory causes stale IP issues
- **Don't hardcode SSH keys in playbooks**: Use GitHub Secrets + action key parameter
- **Don't run playbook multiple times without idempotency checks**: openclaw-ansible is idempotent, but verify before adding custom tasks
- **Don't use `ansible_connection: local` for remote VMs**: Common copy-paste error from localhost playbooks

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSH connection retry logic | Custom polling script | `wait_for_connection` module | Built-in retry/timeout, handles transient network issues, idempotent |
| Cloud-init completion detection | Parse log files manually | `cloud_init_data_facts` module | Structured data, official cloud-init status API, handles all stages |
| Inventory management | Custom Python script | Ansible inventory YAML + dynamic generation | Standard format, supports groups/vars, integrates with all Ansible tools |
| SSH key file handling | Custom file I/O | `dawidd6/action-ansible-playbook` action | Automatic key normalization (CRLF→LF), permission setting, cleanup |
| Agent installation playbook | Custom shell scripts | openclaw-ansible role | 4-layer security, tested UFW/Docker/systemd integration, community-maintained |
| Passwordless sudo setup | Manual user configuration | Root user from Hetzner + become | Hetzner VMs default to root SSH access, no sudo configuration needed |

**Key insight:** Ansible modules are battle-tested for cloud VM provisioning. openclaw-ansible already handles the complex systemd/Docker/security setup. The only "glue code" needed is: (1) generate inventory from Phase 7 metadata, (2) add wait-for-readiness tasks, (3) pass extra-vars for agent configuration.

## Common Pitfalls

### Pitfall 1: Cloud-init vs Ansible Race Condition
**What goes wrong:** Ansible playbook starts before cloud-init finishes, causing package installation conflicts (apt lock) or network misconfiguration (Tailscale not yet enrolled).
**Why it happens:** Phase 7 VM provisioning marks server as "running" when Hetzner API reports success, but cloud-init executes asynchronously after boot. SSH becomes available before cloud-init completes.
**How to avoid:**
```yaml
# Always use both checks in sequence:
- wait_for_connection (SSH available)
- cloud_init_data_facts until stage=='' (cloud-init finished)
```
**Warning signs:** Ansible errors like "Could not get lock /var/lib/dpkg/lock", "Tailscale not found", "Network unreachable"; playbook succeeds on retry but fails on first run.
**Confidence:** HIGH (documented in [Ansible Forum EC2 cloud-init race condition](https://forum.ansible.com/t/ec2-slow-cloud-init-ansible-ssh-connection-fails-due-to-race-condition-wait-for-is-not-good-enough/20345))

### Pitfall 2: SSH Host Key Verification Failures on Fresh VMs
**What goes wrong:** Ansible fails with "Host key verification failed" because fresh VM has new SSH host key not in known_hosts.
**Why it happens:** GitHub Actions runners have empty known_hosts; Tailscale IPs don't have pre-established fingerprints.
**How to avoid:**
```yaml
# Option 1: Accept new host keys (simple, less secure)
options: |
  --ssh-common-args='-o StrictHostKeyChecking=accept-new'

# Option 2: Disable checking (development only)
options: |
  --ssh-common-args='-o StrictHostKeyChecking=no'

# Option 3: Pre-populate known_hosts (most secure)
- name: Add VM to known_hosts
  run: ssh-keyscan -H ${{ steps.provision.outputs.tailscale_ip }} >> ~/.ssh/known_hosts
```
**Warning signs:** Error "Host key verification failed for <IP>"; workflow fails at Ansible connection step.
**Confidence:** HIGH (standard SSH/Ansible behavior, documented in [Red Hat SSH Ansible cheat sheet](https://developers.redhat.com/cheat-sheets/ssh-remote-machines-using-ansible-cheat-sheet))

### Pitfall 3: Assuming Tailscale IP is Immediately Reachable
**What goes wrong:** Ansible SSH connection fails even though Tailscale enrollment verified in Phase 7 - "Connection refused" or "No route to host".
**Why it happens:** Tailscale enrollment (device shows in admin) ≠ Tailscale network routes propagated to GitHub Actions runner. Runner may not be on same Tailnet or subnet ACLs not configured.
**How to avoid:**
- GitHub Actions runner must also be Tailscale node (install Tailscale on runner or use Tailscale GitHub Action)
- Verify runner can ping Tailscale IP before running Ansible
- Alternative: Use Tailscale Funnel/HTTPS proxy if runner can't join Tailnet
```yaml
# Verify connectivity before Ansible
- name: Test Tailscale connectivity
  run: |
    ping -c 3 ${{ steps.provision.outputs.tailscale_ip }} || exit 1
```
**Warning signs:** "Connection refused" to Tailscale IP; `nc -zv <tailscale_ip> 22` fails; playbook works with public IP but not Tailscale IP.
**Confidence:** MEDIUM (depends on Tailscale network topology; Phase 7 research assumed runner has Tailscale access)

### Pitfall 4: openclaw-ansible Idempotency Assumptions
**What goes wrong:** Running playbook multiple times on same VM causes errors (e.g., "User already exists", "Service already enabled").
**Why it happens:** Not all tasks in openclaw-ansible are guaranteed idempotent; some third-party scripts (like Tailscale install.sh) may not handle re-runs gracefully.
**How to avoid:**
- Test playbook re-runs locally before deploying to production
- Add `failed_when: false` for tasks expected to fail on re-run (if non-critical)
- Use Ansible's `creates` parameter for download/install tasks
```yaml
# Example idempotent task:
- name: Install Tailscale
  ansible.builtin.shell: curl -fsSL https://tailscale.com/install.sh | sh
  args:
    creates: /usr/bin/tailscale  # Skip if tailscale binary exists
```
**Warning signs:** Playbook fails on second run with "already exists" errors; manual re-run after failure succeeds.
**Confidence:** MEDIUM (openclaw-ansible should be idempotent by design, but edge cases exist; verify with testing)

### Pitfall 5: Mixing Root and Non-Root Users
**What goes wrong:** Playbook tasks fail with permission errors even with `become: yes` - "Permission denied" for Docker socket, systemd operations.
**Why it happens:** Hetzner VMs default to `root` SSH user, but playbook may expect non-root user + sudo. openclaw-ansible creates `openclaw` system user but initial tasks run as root.
**How to avoid:**
```yaml
# Inventory: Explicitly set user to root (Hetzner default)
ansible_user: root

# Playbook: become is redundant when already root, but doesn't hurt
become: yes  # No-op when user is already root

# If switching to openclaw user mid-playbook:
- name: Switch to openclaw user for service start
  become: yes
  become_user: openclaw
  ansible.builtin.systemd:
    name: openclaw
    state: started
```
**Warning signs:** "Permission denied" errors; Docker commands fail with "Cannot connect to Docker daemon"; systemd operations require manual sudo.
**Confidence:** HIGH (documented in [Hetzner cloud-init SSH key injection](https://docs.hetzner.cloud/), Ansible [become documentation](https://docs.ansible.com/ansible/latest/playbook_guide/playbooks_privilege_escalation.html))

### Pitfall 6: Hardcoded Localhost Assumptions in openclaw-ansible
**What goes wrong:** Playbook tasks reference `localhost` or `127.0.0.1` when they should use `inventory_hostname` or `ansible_host`.
**Why it happens:** openclaw-ansible was designed for local installation; some tasks may hardcode localhost for service bindings, API calls.
**How to avoid:**
- Audit openclaw-ansible tasks for hardcoded localhost references
- Override variables in inventory or extra-vars:
```yaml
# Inventory override:
all:
  hosts:
    agent_vm:
      ansible_host: 100.64.x.x
      openclaw_bind_host: "{{ ansible_host }}"  # Use Tailscale IP instead of 127.0.0.1
```
- Test playbook against remote VM in staging before production
**Warning signs:** Services bind to 127.0.0.1 but inaccessible via Tailscale IP; health checks fail; agent can't communicate with main app.
**Confidence:** LOW (need to audit openclaw-ansible source for localhost dependencies; may not be an issue if services designed for Tailscale access)

### Pitfall 7: Ansible Galaxy Collection Dependencies
**What goes wrong:** Playbook fails with "module not found" errors for `community.general.*` modules.
**Why it happens:** GitHub Actions runner has minimal Ansible installation; `community.general` collection not pre-installed.
**How to avoid:**
```yaml
# Option 1: Install collections in workflow before playbook
- name: Install Ansible collections
  run: |
    ansible-galaxy collection install community.general
    ansible-galaxy collection install hetzner.hcloud  # If using dynamic inventory

# Option 2: Use requirements.yml (recommended)
# Create ansible/requirements.yml:
collections:
  - name: community.general
    version: ">=5.0.0"
  - name: hetzner.hcloud
    version: ">=1.0.0"

# Workflow step:
- name: Install Ansible requirements
  run: ansible-galaxy collection install -r ansible/requirements.yml

# Option 3: Use action's built-in collection support
- uses: dawidd6/action-ansible-playbook@v2
  with:
    playbook: configure-agent.yml
    requirements: ansible/requirements.yml  # Action installs automatically
```
**Warning signs:** Error "MODULE FAILURE: module 'community.general.cloud_init_data_facts' not found"; playbook works locally but fails in CI.
**Confidence:** HIGH (standard Ansible Galaxy behavior, documented in [Ansible collections docs](https://docs.ansible.com/ansible/latest/collections_guide/index.html))

## Code Examples

Verified patterns from official sources:

### Complete GitHub Actions Workflow with Ansible Step
```yaml
# .github/workflows/provision-agent.yml (add after existing VM provisioning step)
name: Provision Agent

on:
  workflow_dispatch:
    inputs:
      job_id:
        required: true
      agent_id:
        required: true
      region:
        required: true
      callback_url:
        required: true

jobs:
  provision:
    runs-on: ubuntu-latest
    timeout-minutes: 20  # Increased from 15 to allow Ansible time

    steps:
      # ... existing steps (checkout, setup node, provision VM) ...

      - name: Provision VM
        id: provision
        env:
          HETZNER_API_TOKEN: ${{ secrets.HETZNER_API_TOKEN }}
          # ... other env vars
        run: npx tsx src/lib/provisioning/provision-vm.ts

      # NEW ANSIBLE CONFIGURATION STEPS:

      - name: Install Ansible
        run: |
          pipx install ansible-core
          pipx inject ansible-core argcomplete

      - name: Install Ansible Collections
        run: |
          ansible-galaxy collection install community.general

      - name: Generate Ansible Inventory
        run: |
          cat > inventory.yml <<EOF
          all:
            hosts:
              agent_vm:
                ansible_host: ${{ steps.provision.outputs.tailscale_ip }}
                ansible_user: root
                ansible_ssh_private_key_file: /tmp/hetzner_ssh_key
                ansible_python_interpreter: /usr/bin/python3
            vars:
              agent_id: "${{ inputs.agent_id }}"
              server_name: "${{ steps.provision.outputs.server_name }}"
              server_id: "${{ steps.provision.outputs.server_id }}"
          EOF

      - name: Configure SSH Key
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.HETZNER_SSH_PRIVATE_KEY }}" > /tmp/hetzner_ssh_key
          chmod 600 /tmp/hetzner_ssh_key
          chmod 700 ~/.ssh

      - name: Run Agent Configuration Playbook
        run: |
          ansible-playbook src/ansible/playbooks/configure-agent.yml \
            -i inventory.yml \
            --extra-vars '{"openclaw_version":"latest"}' \
            --ssh-common-args='-o StrictHostKeyChecking=accept-new' \
            -vv

      - name: Cleanup SSH Key
        if: always()
        run: rm -f /tmp/hetzner_ssh_key

      # ... existing success/failure callback steps ...
```

### Minimal configure-agent.yml Playbook
```yaml
# src/ansible/playbooks/configure-agent.yml
---
- name: Configure OpenClaw Agent on Remote VM
  hosts: all
  become: yes
  gather_facts: no  # Delay fact gathering until VM ready

  tasks:
    # Stage 1: Wait for SSH
    - name: Wait for system to be reachable
      ansible.builtin.wait_for_connection:
        delay: 10
        timeout: 300
        sleep: 5
      retries: 3

    # Stage 2: Wait for cloud-init
    - name: Wait for cloud-init to complete
      community.general.cloud_init_data_facts:
      register: cloud_init_status
      until: >
        cloud_init_status.cloud_init_data_facts is defined and
        cloud_init_status.cloud_init_data_facts.status.v1.stage is defined and
        cloud_init_status.cloud_init_data_facts.status.v1.stage == ''
      retries: 60
      delay: 10

    # Stage 3: Now safe to gather facts
    - name: Gather system facts
      ansible.builtin.setup:

    # Stage 4: Run openclaw-ansible role
    - name: Configure OpenClaw agent
      ansible.builtin.import_role:
        name: openclaw
      vars:
        # Pass agent-specific config from inventory/extra-vars
        openclaw_agent_id: "{{ agent_id }}"
        openclaw_server_name: "{{ server_name }}"
        openclaw_api_url: "{{ openclaw_api_url | default('https://api.aura.example.com') }}"

    # Stage 5: Verify service is running
    - name: Ensure openclaw service is running
      ansible.builtin.systemd_service:
        name: openclaw
        state: started
        enabled: yes
      register: service_status

    - name: Display service status
      ansible.builtin.debug:
        msg: "OpenClaw service status: {{ service_status.status.ActiveState }}"
```

### Dynamic Inventory Template (TypeScript Generation)
```typescript
// src/lib/provisioning/generate-inventory.ts
export interface AnsibleInventoryConfig {
  agentId: string;
  tailscaleIp: string;
  serverName: string;
  serverId: number;
  sshKeyPath?: string;
}

export function generateAnsibleInventory(config: AnsibleInventoryConfig): string {
  const inventory = {
    all: {
      hosts: {
        agent_vm: {
          ansible_host: config.tailscaleIp,
          ansible_user: 'root',
          ansible_ssh_private_key_file: config.sshKeyPath || '/tmp/hetzner_ssh_key',
          ansible_python_interpreter: '/usr/bin/python3',
        },
      },
      vars: {
        agent_id: config.agentId,
        server_name: config.serverName,
        server_id: config.serverId,
      },
    },
  };

  return require('yaml').stringify(inventory);
}

// Usage in GitHub Actions:
// const inventory = generateAnsibleInventory({
//   agentId: process.env.AGENT_ID!,
//   tailscaleIp: provisionResult.tailscaleIp,
//   serverName: provisionResult.serverName,
//   serverId: provisionResult.serverId,
// });
// fs.writeFileSync('inventory.yml', inventory);
```

### Error Handling and Retry Logic
```yaml
# src/ansible/playbooks/configure-agent.yml (enhanced)
- name: Install critical packages with retry
  ansible.builtin.apt:
    name:
      - docker.io
      - docker-compose
    state: present
    update_cache: yes
  retries: 5
  delay: 30
  register: apt_result
  until: apt_result is succeeded
  # Handles transient apt lock issues from cloud-init

- name: Start Docker service with error handling
  ansible.builtin.systemd_service:
    name: docker
    state: started
    enabled: yes
  retries: 3
  delay: 10
  register: docker_start
  failed_when:
    - docker_start.failed
    - "'already running' not in docker_start.msg"
  # Don't fail if Docker already running (idempotency)

- name: Verify Tailscale is running (from cloud-init)
  ansible.builtin.command: tailscale status
  register: tailscale_status
  failed_when: false
  changed_when: false

- name: Fail if Tailscale not configured
  ansible.builtin.fail:
    msg: "Tailscale not running - cloud-init may have failed"
  when: tailscale_status.rc != 0
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Ansible 2.9 (Python 2.7) | Ansible Core 2.20 (Python 3.12-3.14) | Nov 2025 | Improved connection stability, execution environment compatibility |
| Static inventory files | Dynamic inventory generation + plugins | Ongoing (standard 2026) | Better cloud integration, auto-discovery, less manual maintenance |
| `ansible_ssh_host` variable | `ansible_host` variable | Ansible 2.0+ | Clearer naming, `ansible_ssh_host` deprecated |
| `--ask-become-pass` for sudo | SSH key-based root login | Cloud VMs standard | No password prompts in CI/CD, secure key management |
| Manual cloud-init polling | `cloud_init_data_facts` module | community.general 3.0+ | Structured status API, reliable completion detection |
| pipenv/virtualenv for Ansible | pipx (isolated tool install) | 2026 best practice | Simpler dependency isolation, recommended by Ansible docs |

**Deprecated/outdated:**
- **`ansible_ssh_host`**: Use `ansible_host` instead (deprecated since Ansible 2.0, still works but warns)
- **Python 2.7 support**: Ansible Core 2.20 requires Python 3.8+ on control node
- **`include` directive**: Use `import_role` or `include_role` (include deprecated in Ansible 2.8)

## Open Questions

1. **Should we vendor openclaw-ansible or reference as git submodule?**
   - What we know: openclaw-ansible is actively maintained on GitHub; playbook expects to be run from its directory structure
   - What's unclear: Risk of breaking changes in upstream vs maintenance burden of vendored fork
   - Recommendation: Use git submodule for Phase 8 (easy updates, track upstream). Switch to vendored fork in Phase 9 if we need custom modifications for multi-tenancy.

2. **Do we need per-agent SSH keys or single platform key?**
   - What we know: Phase 7 uses single Hetzner SSH key (HETZNER_SSH_KEY_ID) for all VMs; Ansible needs corresponding private key
   - What's unclear: Security tradeoff between key rotation complexity and blast radius
   - Recommendation: Single platform key for Phase 8 (simpler), add per-agent key rotation in Phase 11 (security hardening milestone).

3. **Should GitHub Actions runner join Tailscale network or use alternative access?**
   - What we know: Ansible needs SSH access to Tailscale IP; GitHub Actions runners are ephemeral
   - What's unclear: Best pattern for ephemeral runner Tailscale enrollment (Tailscale GitHub Action exists but adds complexity)
   - Recommendation: For Phase 8, use Tailscale GitHub Action to join runner to Tailnet. Alternative: Use public IP for Ansible SSH (less secure, requires UFW rule modification in Phase 7 cloud-init).

4. **How to handle partial failures in multi-step configuration?**
   - What we know: Ansible playbook has multiple stages (Docker install, agent deploy, service start); any can fail
   - What's unclear: Should we retry entire playbook or resume from failed task? Database update timing?
   - Recommendation: Ansible playbook should be fully idempotent (safe to re-run). Workflow should retry entire playbook on failure (max 2 retries). Update database only after successful playbook completion.

5. **What's the minimal set of openclaw-ansible tasks needed?**
   - What we know: openclaw-ansible includes UFW, Fail2ban, Docker, Node.js, Tailscale (overlaps with Phase 7 cloud-init)
   - What's unclear: Can we skip redundant tasks (Tailscale already installed) or run full playbook for safety?
   - Recommendation: Run full openclaw-ansible playbook for Phase 8 (ensures idempotency testing, handles edge cases). Optimize in Phase 11 by creating minimal playbook that skips Phase 7 duplicates.

## Sources

### Primary (HIGH confidence)
- [OpenClaw Ansible GitHub Repository](https://github.com/openclaw/openclaw-ansible) - Official playbook source
- [Ansible Official Documentation: Connection Methods](https://docs.ansible.com/ansible/latest/inventory_guide/connection_details.html) - SSH configuration
- [Ansible Official Documentation: Inventory Guide](https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html) - Inventory best practices
- [Ansible wait_for_connection Module](https://docs.ansible.com/projects/ansible/latest/collections/ansible/builtin/wait_for_connection_module.html) - VM readiness
- [Ansible cloud_init_data_facts Module](https://docs.ansible.com/ansible/latest/collections/community/general/cloud_init_data_facts_module.html) - Cloud-init verification
- [Ansible systemd_service Module](https://docs.ansible.com/projects/ansible/latest/collections/ansible/builtin/systemd_service_module.html) - Service management
- [Ansible Extra Variables Documentation](https://www.redhat.com/en/blog/extra-variables-ansible-playbook) - Variable passing
- [Hetzner.hcloud Ansible Collection](https://docs.ansible.com/ansible/latest/collections/hetzner/hcloud/hcloud_inventory.html) - Dynamic inventory

### Secondary (MEDIUM confidence)
- [GitHub: dawidd6/action-ansible-playbook](https://github.com/dawidd6/action-ansible-playbook) - GitHub Actions integration (v1.2.0, updated Oct 2024)
- [Spacelift: GitHub Actions Ansible Guide (2026)](https://spacelift.io/blog/github-actions-ansible) - CI/CD best practices
- [Ansible Complete Guide for 2026 - DevToolbox Blog](https://devtoolbox.dedyn.io/blog/ansible-complete-guide) - Current year best practices
- [Ansible Forum: EC2 cloud-init race condition](https://forum.ansible.com/t/ec2-slow-cloud-init-ansible-ssh-connection-fails-due-to-race-condition-wait-for-is-not-good-enough/20345) - Cloud-init timing pitfall
- [Red Hat: SSH Remote Machines Ansible Cheat Sheet](https://developers.redhat.com/cheat-sheets/ssh-remote-machines-using-ansible-cheat-sheet) - SSH configuration patterns
- [Making Ansible Faster: Tips and Best Practices](https://omarelfarsaoui.medium.com/making-ansible-faster-tips-and-best-practices-1164ef950de5) - Performance optimization
- [Ansible Error Handling Guide](https://docs.ansible.com/projects/ansible/latest/playbook_guide/playbooks_error_handling.html) - Retry and failure patterns
- [TheLinuxCode: Ansible Retries](https://thelinuxcode.com/ansible-retries/) - Retry logic implementation

### Tertiary (LOW confidence - needs validation)
- [Matt Knight: Dynamic Inventory with Hetzner Cloud](https://www.mattknight.io/blog/dynamic-inventory-in-ansible-with-hetzner-cloud) - Practical example (date unknown)
- [GitHub: ansible-best-practices](https://github.com/fdavis/ansible-best-practices) - Community patterns

## Metadata

**Confidence breakdown:**
- Ansible remote execution patterns: HIGH - Official docs, verified by multiple sources
- openclaw-ansible adaptation: MEDIUM-HIGH - Playbook structure verified, localhost→remote changes standard but need testing
- GitHub Actions integration: HIGH - Official actions exist, SSH key handling documented
- Cloud-init timing: HIGH - Official modules exist, race condition well-documented
- Error handling patterns: HIGH - Built-in Ansible features, documented best practices

**Research date:** 2026-02-13
**Valid until:** 2026-03-15 (30 days; Ansible core stable, openclaw-ansible may update)

**Next validation needed:**
- Test openclaw-ansible playbook against fresh Hetzner VM in isolation
- Verify Tailscale access from GitHub Actions runner (may need Tailscale Action)
- Confirm cloud-init completion timing on Hetzner CPX11 instances
- Audit openclaw-ansible for localhost dependencies requiring variable overrides
- Test playbook idempotency with multiple runs
