# Snapshot Security Architecture

## Principles

1. **No secrets in snapshots** — Snapshots are base images only
2. **Secrets injected at runtime** — Via environment files or secret managers
3. **Regular rebuilds** — Weekly schedule catches security patches
4. **Least privilege** — CI has minimal permissions needed

---

## What's IN the Snapshot

- Ubuntu 24.04 LTS (latest security patches at build time)
- Docker + Docker Compose
- Node.js 20 LTS
- Tailscale (for secure networking)
- fail2ban (brute force protection)
- UFW firewall (configured but secrets-free)
- Unattended upgrades (automatic security patches)
- `aura` system user (unprivileged)
- Directory structure (`/opt/aura/{config,app,logs,data}`)
- systemd service template

## What's NOT in the Snapshot

- ❌ API keys
- ❌ Database credentials  
- ❌ Tailscale auth keys
- ❌ Any tokens or passwords
- ❌ SSH host keys (regenerated on first boot)
- ❌ Application code (deployed separately)

---

## Runtime Secret Injection

When a server boots from the snapshot, secrets are injected via:

### Option 1: Environment File (Simple)

```bash
# During deployment, write secrets to the server:
ssh root@$SERVER_IP << 'EOF'
cat > /opt/aura/config/agent.env << 'ENVEOF'
DATABASE_URL=postgres://user:pass@host:5432/db
OPENAI_API_KEY=sk-xxx
TAILSCALE_AUTHKEY=tskey-xxx
ENVEOF

chmod 600 /opt/aura/config/agent.env
chown aura:aura /opt/aura/config/agent.env
EOF
```

### Option 2: Cloud-Init (Better)

Pass secrets via Hetzner's user_data at server creation:

```bash
curl -X POST "https://api.hetzner.cloud/v1/servers" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "aura-agent-1",
    "image": "'$SNAPSHOT_ID'",
    "user_data": "#cloud-config\nwrite_files:\n  - path: /opt/aura/config/agent.env\n    permissions: \"0600\"\n    owner: aura:aura\n    content: |\n      DATABASE_URL=...\n      API_KEY=..."
  }'
```

### Option 3: Secret Manager (Best)

For production, use a secret manager:

1. Server boots with minimal bootstrap secret (Tailscale key)
2. Joins Tailscale network
3. Fetches secrets from Vault/AWS Secrets Manager/etc via secure network

---

## CI/CD Security

### SSH Key Isolation

- Dedicated SSH key for snapshot builds (`SNAPSHOT_SSH_PRIVATE_KEY`)
- NOT the same key used for deployment or personal access
- Can be rotated independently

### Required GitHub Secrets

| Secret | Purpose |
|--------|---------|
| `HETZNER_API_TOKEN` | Hetzner Cloud API access |
| `SNAPSHOT_SSH_PRIVATE_KEY` | SSH into build VMs |
| `HETZNER_SSH_KEY_NAME` | Name of public key in Hetzner |

### Environment Protection

The workflow uses GitHub's `environment: production` which allows:
- Required reviewers before snapshot builds
- Deployment protection rules
- Environment-specific secrets

---

## Scheduled Rebuilds

Snapshots rebuild automatically every Sunday at 3am UTC.

This ensures:
- Latest security patches included
- No drift from base configuration
- Known-good state weekly

Manual rebuilds can be triggered anytime via workflow_dispatch.

---

## Verification

After snapshot creation, verify no secrets are baked in:

```bash
# Boot a test server from the snapshot
# Then check for secrets:

# Should be empty or not exist:
cat /opt/aura/config/agent.env

# Should show no sensitive env vars:
env | grep -i key
env | grep -i secret
env | grep -i token
env | grep -i password

# SSH host keys should be regenerated (different from other servers):
cat /etc/ssh/ssh_host_ed25519_key.pub
```

---

## Incident Response

If a snapshot is compromised:

1. **Immediately**: Delete the compromised snapshot from Hetzner
2. **Rotate**: All secrets that may have been exposed
3. **Rebuild**: Create new snapshot with workflow
4. **Redeploy**: All servers from the new snapshot
5. **Audit**: Review CI logs for unauthorized access
