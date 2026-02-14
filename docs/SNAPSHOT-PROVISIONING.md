# Snapshot-Based Provisioning

This document describes the snapshot-based provisioning system for Aura agents, which reduces deployment time from ~8 minutes to ~1-2 minutes.

## Overview

Instead of installing all dependencies (Docker, Node.js, security tools) on every new agent VM, we pre-bake a Hetzner snapshot with everything installed. When deploying a new agent, we:

1. Create a VM from the snapshot (already has all software)
2. Use cloud-init to configure agent-specific settings
3. Start the agent service

This eliminates the need for Ansible during normal deployments.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Snapshot Contents                        │
├─────────────────────────────────────────────────────────────┤
│ • Ubuntu 22.04 base                                         │
│ • Docker CE + Docker Compose                                │
│ • Node.js 20.x                                              │
│ • Tailscale (installed, not enrolled)                       │
│ • fail2ban (configured and enabled)                         │
│ • UFW firewall (SSH + Tailscale ports open)                 │
│ • openclaw user with /opt/openclaw structure                │
│ • openclaw-agent.service systemd unit                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Cloud-init (at boot)                        │
├─────────────────────────────────────────────────────────────┤
│ • Enroll in Tailscale with ephemeral auth key               │
│ • Write agent.env with AGENT_ID, SERVER_NAME, API_URL       │
│ • Start openclaw-agent service                              │
└─────────────────────────────────────────────────────────────┘
```

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
| `SSH_PRIVATE_KEY_PATH` | Path to SSH private key (optional, tries ~/.ssh/id_rsa) |

## Building a New Snapshot

### When to Rebuild

Rebuild the snapshot when:
- Updating base OS packages (security updates)
- Changing Docker or Node.js versions
- Modifying security configuration (fail2ban, UFW rules)
- Updating the openclaw user or directory structure
- Changing the systemd service file template

You do NOT need to rebuild when:
- Deploying new agent code (handled at runtime)
- Changing agent environment variables
- Modifying Tailscale tags or settings

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
   chmod +x src/scripts/build-snapshot.sh
   ./src/scripts/build-snapshot.sh
   ```

3. **Update GitHub Secrets:**
   The script outputs the new snapshot ID. Update `HETZNER_SNAPSHOT_ID` in GitHub Secrets.

### What the Build Script Does

1. Creates a temporary Hetzner VM (cpx11, ubuntu-22.04)
2. Waits for SSH connectivity
3. Installs and configures:
   - Docker CE and Docker Compose
   - Node.js 20.x
   - Tailscale (not enrolled)
   - fail2ban with SSH protection
   - UFW firewall
4. Creates the openclaw user and directory structure
5. Installs the systemd service template
6. Cleans up caches and logs
7. Powers off the VM
8. Creates a Hetzner snapshot
9. Deletes the temporary VM
10. Outputs the snapshot ID

### Build Time

The build process takes approximately 5-7 minutes.

## Provisioning Modes

### Snapshot Mode (Fast Path)

When `HETZNER_SNAPSHOT_ID` is set:
- VM created from snapshot (~30 seconds)
- Cloud-init configures agent settings (~30 seconds)
- Tailscale enrollment (~30 seconds)
- Agent service starts (~10 seconds)

**Total time: ~1-2 minutes**

### Fallback Mode (Slow Path)

When `HETZNER_SNAPSHOT_ID` is NOT set:
- VM created from ubuntu-22.04 (~30 seconds)
- Cloud-init installs Tailscale (~1 minute)
- Ansible configures everything (~6-7 minutes)

**Total time: ~8 minutes**

## Directory Structure on VM

```
/opt/openclaw/
├── agent/          # Agent code (deployed at runtime)
│   └── index.js
├── config/         # Configuration files
│   ├── agent.env   # Environment variables (created by cloud-init)
│   └── provisioned_at  # Provisioning metadata
└── logs/           # Agent logs (if not using journald)
```

## Systemd Service

The `openclaw-agent.service` is pre-installed in the snapshot:

```ini
[Unit]
Description=OpenClaw Agent Service
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
User=openclaw
EnvironmentFile=/opt/openclaw/config/agent.env
ExecStart=/usr/bin/node /opt/openclaw/agent/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openclaw-agent

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### Snapshot Not Found Error

If provisioning fails with "image not found":
1. Verify `HETZNER_SNAPSHOT_ID` is correct
2. Check the snapshot exists in Hetzner Console
3. Ensure the snapshot is in the same project as the API token

### Cloud-init Timeout

If cloud-init takes too long:
1. SSH to the VM and check `/var/log/cloud-init-output.log`
2. Verify Tailscale auth key is valid
3. Check network connectivity

### Agent Service Won't Start

If the agent service fails to start:
1. Check journald: `journalctl -u openclaw-agent -f`
2. Verify `/opt/openclaw/config/agent.env` exists and has correct values
3. Ensure agent code is deployed to `/opt/openclaw/agent/`

## Migration Guide

### From Ansible-Only to Snapshot

1. Build initial snapshot: `./src/scripts/build-snapshot.sh`
2. Test with a single agent deployment
3. Update `HETZNER_SNAPSHOT_ID` in GitHub Secrets
4. All subsequent deployments will use the fast path

### Reverting to Ansible-Only

Simply remove `HETZNER_SNAPSHOT_ID` from GitHub Secrets. The provisioning system will automatically fall back to the Ansible-based flow.

## Security Notes

- The snapshot does NOT contain any secrets or credentials
- Tailscale auth keys are ephemeral and generated per-deployment
- Agent environment variables are written by cloud-init at boot
- UFW and fail2ban are pre-configured for security
- The openclaw user cannot log in (shell is /usr/sbin/nologin)
