/**
 * Cloud-init configuration generator
 * Produces cloud-init YAML for VM provisioning with Tailscale integration
 */

interface CloudInitParams {
  tailscaleAuthKey: string;
  hostname: string;
}

/**
 * Generate cloud-init configuration for VM provisioning
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

  console.log(`[CloudInit] Generated cloud-init config for ${hostname}`);

  return config;
}
