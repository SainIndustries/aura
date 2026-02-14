# Snapshot-Based Provisioning (Hybrid Model)

This document describes the hybrid provisioning system for Aura agents, which reduces deployment time from ~8 minutes to ~1-2 minutes while maintaining flexibility.

## Overview

The hybrid model combines the speed of pre-baked snapshots with the flexibility of Ansible:

| Component | Snapshot | Ansible |
|-----------|----------|---------|
| Docker CE + Compose | ✅ Pre-installed | - |
| Node.js 20.x | ✅ Pre-installed | - |
| Tailscale | ✅ Pre-installed | - |
| fail2ban | ✅ Pre-configured | - |
| UFW firewall | ✅ Pre-configured | - |
| openclaw user | ✅ Created | - |
| Agent env vars | - | ✅ Configured |
| Agent service | Template | ✅ Enabled/started |
| Per-agent settings | - | ✅ Dynamic |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 Snapshot (Pre-baked)                        │
│                 ~30 seconds to boot                         │
├─────────────────────────────────────────────────────────────┤
│ • Ubuntu 22.04 base                                         │
│ • Docker CE + Docker Compose                                │
│ • Node.js 20.x                                              │
│ • Tailscale (installed, not enrolled)                       │
│ • fail2ban (configured and running)                         │
│ • UFW firewall (SSH + Tailscale ports)                      │
│ • openclaw user with /opt/openclaw structure                │
│ • openclaw-agent.service template                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Cloud-init (at boot)                        │
│                 ~30 seconds                                 │
├─────────────────────────────────────────────────────────────┤
│ • Sync system clock                                         │
│ • Enroll in Tailscale with ephemeral auth key               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Ansible (Lightweight Playbook)                 │
│                 ~30-60 seconds                              │
├─────────────────────────────────────────────────────────────┤
│ • Verify pre-installed components                           │
│ • Create agent.env with AGENT_ID, API_URL, etc.             │
│ • Enable and start openclaw-agent service                   │
│ • Final verification                                        │
└─────────────────────────────────────────────────────────────┘
```

## Why Hybrid?

**Pure snapshot approach:**
- ❌ Requires rebuilding snapshot for any config change
- ❌ No per-agent customization without cloud-init complexity
- ❌ Hard to debug configuration issues

**Pure Ansible approach:**
- ❌ Slow (6-7 minutes for full setup)
- ❌ Network-dependent (apt installs can fail)
- ✅ Flexible and debuggable

**Hybrid approach:**
- ✅ Fast (~1-2 minutes total)
- ✅ Snapshot only needs rebuilding for infrastructure changes
- ✅ Ansible handles all agent-specific config
- ✅ Easy to update agent settings without new snapshot
- ✅ Familiar debugging with Ansible

## Provisioning Modes

### Snapshot-Hybrid Mode (Fast Path)

When `HETZNER_SNAPSHOT_ID` is set:

| Step | Time | Component |
|------|------|-----------|
| VM boot from snapshot | ~30s | Hetzner |
| Tailscale enrollment | ~30s | cloud-init |
| Agent configuration | ~30-60s | Ansible (lightweight) |
| **Total** | **~1-2 min** | |

### Full Mode (Fallback)

When `HETZNER_SNAPSHOT_ID` is NOT set:

| Step | Time | Component |
|------|------|-----------|
| VM boot from ubuntu-22.04 | ~30s | Hetzner |
| Tailscale install + enroll | ~60s | cloud-init |
| Full configuration | ~6-7 min | Ansible (full playbook) |
| **Total** | **~8 min** | |

## Environment Variables

### Required for Provisioning

| Variable | Description | Where to Set |
|----------|-------------|--------------|
| `HETZNER_API_TOKEN` | Hetzner Cloud API token | GitHub Secrets |
| `HETZNER_SSH_KEY_ID` | ID of SSH key in Hetzner | GitHub Secrets |
| `HETZNER_SNAPSHOT_ID` | Snapshot ID for fast provisioning | GitHub Secrets |
| `TAILSCALE_OAUTH_CLIENT_ID` | Tailscale OAuth client ID | GitHub Secrets |
| `TAILSCALE_OAUTH_CLIENT_SECRET` | Tailscale OAuth secret | GitHub Secrets |
| `AURA_API_URL` | Aura API URL for agent callbacks | GitHub Secrets |

### Required for Building Snapshots

| Variable | Description |
|----------|-------------|
| `HETZNER_API_TOKEN` | Hetzner Cloud API token |
| `HETZNER_SSH_KEY_ID` | ID of SSH key in Hetzner |
| `SSH_PRIVATE_KEY_PATH` | Path to SSH private key (optional) |

## Building a New Snapshot

### When to Rebuild

**Rebuild when changing:**
- Base OS packages (security updates)
- Docker or Node.js versions
- Security configuration (fail2ban rules, UFW ports)
- openclaw user or directory structure
- systemd service file template

**Don't rebuild for:**
- Agent environment variables (Ansible handles this)
- Agent code updates (deployed at runtime)
- Per-agent customization (Ansible handles this)
- API URL changes (Ansible handles this)

### Build Process

1. **Set environment variables:**
   ```bash
   export HETZNER_API_TOKEN="your-token"
   export HETZNER_SSH_KEY_ID="12345"
   export SSH_PRIVATE_KEY_PATH="~/.ssh/id_rsa"  # Optional
   ```

2. **Run the build script:**
   ```bash
   cd /path/to/aura
   ./src/scripts/build-snapshot.sh
   ```

3. **Update GitHub Secrets:**
   Set `HETZNER_SNAPSHOT_ID` to the output snapshot ID.

### Build Time

The build process takes approximately 5-7 minutes.

## Ansible Playbooks

### Snapshot Mode: `configure-agent-snapshot.yml`

Lightweight playbook that runs in ~30-60 seconds:
- Waits for SSH and cloud-init
- Verifies pre-installed components (Docker, Node.js)
- Creates agent environment file
- Enables and starts agent service
- Final verification

### Full Mode: `configure-agent.yml`

Complete playbook that runs in ~6-7 minutes:
- Full package installation (Docker, Node.js)
- Security hardening (fail2ban, UFW)
- User creation
- All agent configuration

## Directory Structure on VM

```
/opt/openclaw/
├── agent/          # Agent code (deployed at runtime)
│   └── index.js
├── config/
│   ├── agent.env         # Environment variables (Ansible)
│   └── provisioned_at    # Provisioning metadata (Ansible)
└── logs/           # Agent logs (if not using journald)
```

## Agent Environment File

Created by Ansible at `/opt/openclaw/config/agent.env`:

```bash
AGENT_ID=abc123
SERVER_NAME=agent-abc12345-1234567890
SERVER_ID=12345678
API_URL=https://aura.openclaw.ai
NODE_ENV=production
```

## Troubleshooting

### Snapshot Not Found

If provisioning fails with "image not found":
1. Verify `HETZNER_SNAPSHOT_ID` is correct
2. Check snapshot exists in Hetzner Console
3. Ensure snapshot is in same project as API token

### Ansible Fails on Snapshot Mode

If the lightweight playbook fails:
1. Check if snapshot is properly built (all components installed)
2. SSH to VM and verify: `docker --version`, `node --version`
3. Check `/var/log/cloud-init-output.log` for Tailscale issues

### Agent Service Won't Start

1. Check journald: `journalctl -u openclaw-agent -f`
2. Verify `/opt/openclaw/config/agent.env` exists
3. Ensure agent code is deployed to `/opt/openclaw/agent/`

## Migration Guide

### From Full Ansible to Hybrid

1. Build initial snapshot: `./src/scripts/build-snapshot.sh`
2. Note the snapshot ID from output
3. Set `HETZNER_SNAPSHOT_ID` in GitHub Secrets
4. Next deployment will use hybrid mode automatically

### Reverting to Full Ansible

Remove `HETZNER_SNAPSHOT_ID` from GitHub Secrets. The system automatically falls back to full Ansible mode.

## Security Notes

- Snapshot contains NO secrets or credentials
- Tailscale auth keys are ephemeral (generated per-deployment)
- Agent environment variables are written by Ansible at deploy time
- UFW and fail2ban are pre-configured in snapshot
- openclaw user has nologin shell
