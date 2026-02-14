/**
 * Cloud-init configuration generator
 * Produces cloud-init YAML for VM provisioning
 * 
 * Two modes:
 * 1. Basic mode (generateCloudInitConfig): Just Tailscale enrollment for fallback provisioning
 * 2. Snapshot mode (generateSnapshotCloudInitConfig): Full agent configuration for pre-baked snapshots
 */

interface CloudInitParams {
  tailscaleAuthKey: string;
  hostname: string;
}

interface SnapshotCloudInitParams extends CloudInitParams {
  agentId: string;
  apiUrl: string;
}

/**
 * Generate basic cloud-init configuration for fallback provisioning
 * Only installs Tailscale - Ansible handles the rest
 * @param params - Configuration parameters
 * @returns Cloud-init YAML string
 */
export function generateCloudInitConfig(params: CloudInitParams): string {
  const { tailscaleAuthKey, hostname } = params;

  const config = `#cloud-config
runcmd:
  - systemctl restart systemd-timesyncd
  - timeout 60 bash -c 'until timedatectl status | grep -q "System clock synchronized: yes"; do sleep 1; done'
  - curl -fsSL https://tailscale.com/install.sh | sh
  - tailscale up --auth-key=${tailscaleAuthKey} --advertise-tags=tag:agent --hostname=${hostname}
`;

  console.log(`[CloudInit] Generated basic cloud-init config for ${hostname}`);

  return config;
}

/**
 * Generate full cloud-init configuration for snapshot-based provisioning
 * 
 * When using a pre-baked snapshot, this configures:
 * - Tailscale enrollment with agent tags
 * - Agent environment file with agent_id and API URL
 * - Enables and starts the openclaw-agent service
 * 
 * The snapshot already includes:
 * - Docker, Node.js 20
 * - fail2ban, UFW (pre-configured)
 * - openclaw user and directory structure
 * - systemd service file template
 * 
 * @param params - Configuration parameters
 * @returns Cloud-init YAML string
 */
export function generateSnapshotCloudInitConfig(params: SnapshotCloudInitParams): string {
  const { tailscaleAuthKey, hostname, agentId, apiUrl } = params;

  // Cloud-init YAML for snapshot-based provisioning
  // The snapshot already has everything installed, we just configure and start
  const config = `#cloud-config

# Ensure time sync first
runcmd:
  # Sync system clock
  - systemctl restart systemd-timesyncd
  - timeout 60 bash -c 'until timedatectl status | grep -q "System clock synchronized: yes"; do sleep 1; done' || true
  
  # Enroll in Tailscale
  - tailscale up --auth-key=${tailscaleAuthKey} --advertise-tags=tag:agent --hostname=${hostname}
  
  # Create agent environment file
  - |
    cat > /opt/openclaw/config/agent.env << 'ENVFILE'
    AGENT_ID=${agentId}
    SERVER_NAME=${hostname}
    API_URL=${apiUrl}
    NODE_ENV=production
    ENVFILE
  
  # Fix permissions
  - chown openclaw:openclaw /opt/openclaw/config/agent.env
  - chmod 600 /opt/openclaw/config/agent.env
  
  # Reload and start the agent service
  - systemctl daemon-reload
  - systemctl enable openclaw-agent
  - systemctl start openclaw-agent || true
  
  # Log completion
  - echo "Cloud-init agent configuration complete for ${hostname}" | systemd-cat -t openclaw-agent

# Write agent config marker file
write_files:
  - path: /opt/openclaw/config/provisioned_at
    content: |
      ${new Date().toISOString()}
      mode: snapshot
      agent_id: ${agentId}
      hostname: ${hostname}
    owner: openclaw:openclaw
    permissions: '0644'

# Final message
final_message: "OpenClaw agent ${agentId} provisioned successfully on ${hostname}"
`;

  console.log(`[CloudInit] Generated snapshot-mode cloud-init config for ${hostname} (agent: ${agentId})`);

  return config;
}
