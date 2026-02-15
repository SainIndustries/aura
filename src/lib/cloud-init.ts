/**
 * Cloud-init configuration generator
 * Produces cloud-init YAML for VM provisioning
 * 
 * Two modes:
 * 1. Basic mode (generateCloudInitConfig): Installs Tailscale for fallback provisioning
 * 2. Snapshot mode (generateSnapshotCloudInitConfig): Just Tailscale enrollment (tools pre-installed)
 * 
 * In both modes, Ansible handles agent-specific configuration.
 */

interface CloudInitParams {
  tailscaleAuthKey: string;
  hostname: string;
}

/**
 * Generate cloud-init configuration for fallback provisioning (no snapshot)
 * Installs Tailscale from scratch - Ansible handles everything else
 * @param params - Configuration parameters
 * @returns Cloud-init YAML string
 */
export function generateCloudInitConfig(params: CloudInitParams): string {
  const { tailscaleAuthKey, hostname } = params;

  const config = `#cloud-config
runcmd:
  - systemctl restart systemd-timesyncd
  - "timeout 60 bash -c 'until timedatectl status | grep -q synchronized; do sleep 1; done' || true"
  - curl -fsSL https://tailscale.com/install.sh | sh
  - tailscale up --auth-key=${tailscaleAuthKey} --advertise-tags=tag:agent --hostname=${hostname}
`;

  console.log(`[CloudInit] Generated basic cloud-init config for ${hostname}`);

  return config;
}

/**
 * Generate cloud-init configuration for snapshot-based provisioning
 * 
 * The snapshot already has Tailscale installed, so we just need to:
 * - Sync time
 * - Enroll in Tailscale
 * 
 * Ansible handles all agent-specific configuration (env vars, service setup).
 * This hybrid approach gives us speed from snapshot + flexibility from Ansible.
 * 
 * @param params - Configuration parameters
 * @returns Cloud-init YAML string
 */
export function generateSnapshotCloudInitConfig(params: CloudInitParams): string {
  const { tailscaleAuthKey, hostname } = params;

  const config = `#cloud-config
runcmd:
  - systemctl restart systemd-timesyncd
  - "timeout 60 bash -c 'until timedatectl status | grep -q synchronized; do sleep 1; done' || true"
  - tailscale up --auth-key=${tailscaleAuthKey} --advertise-tags=tag:agent --hostname=${hostname}
  - echo "cloud-init complete" > /tmp/cloud-init-done
`;

  console.log(`[CloudInit] Generated snapshot-mode cloud-init config for ${hostname}`);

  return config;
}
