import { updateInstanceStatus } from "./index";

// Simulated delays (in ms)
const STEP_DELAYS = {
  queueToProvisioning: 2000,     // 2 seconds to start provisioning
  provisioningToRunning: 8000,   // 8 seconds to provision (server + install + configure)
  stoppingToStopped: 3000,       // 3 seconds to terminate
};

// Failure probability (0-1) - set to 0.1 for 10% failure rate in testing
const FAILURE_PROBABILITY = 0.05;

/**
 * Generate a fake Hetzner-style server ID
 */
function generateServerId(): string {
  return `hetzner-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Generate a fake IP address
 */
function generateIp(prefix: string = "192.168"): string {
  return `${prefix}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

/**
 * Simulate the provisioning process
 * This will be replaced with real Hetzner/Terraform/Ansible calls later
 */
export async function simulateProvisioning(instanceId: string): Promise<void> {
  console.log(`[Simulator] Starting provisioning simulation for instance ${instanceId}`);

  // Wait a bit, then move to "provisioning"
  await delay(STEP_DELAYS.queueToProvisioning);

  console.log(`[Simulator] Would execute: terraform apply -var="instance_id=${instanceId}"`);
  console.log(`[Simulator] Creating Hetzner server in region us-east...`);

  await updateInstanceStatus(instanceId, {
    status: "provisioning",
  });

  // Simulate the actual provisioning work
  await delay(STEP_DELAYS.provisioningToRunning / 2);

  // Check for simulated failure
  if (Math.random() < FAILURE_PROBABILITY) {
    console.log(`[Simulator] Simulated failure during provisioning`);
    await updateInstanceStatus(instanceId, {
      status: "failed",
      error: "Simulated failure: Unable to create server (random failure for testing)",
    });
    return;
  }

  // Generate fake infrastructure details
  const serverId = generateServerId();
  const serverIp = generateIp("159.223");
  const tailscaleIp = generateIp("100.64");

  console.log(`[Simulator] Server created: ${serverId} (${serverIp})`);
  console.log(`[Simulator] Would execute: ansible-playbook setup-agent.yml -i ${serverIp}`);
  console.log(`[Simulator] Installing Clawdbot runtime...`);
  console.log(`[Simulator] Configuring Tailscale VPN...`);

  await delay(STEP_DELAYS.provisioningToRunning / 2);

  // Final success
  console.log(`[Simulator] Provisioning complete. Agent is running.`);
  console.log(`[Simulator] Tailscale IP: ${tailscaleIp}`);

  await updateInstanceStatus(instanceId, {
    status: "running",
    serverId,
    serverIp,
    tailscaleIp,
    startedAt: new Date(),
  });
}

/**
 * Simulate the termination process
 */
export async function simulateTermination(instanceId: string): Promise<void> {
  console.log(`[Simulator] Starting termination simulation for instance ${instanceId}`);

  // Wait a bit to simulate cleanup
  await delay(STEP_DELAYS.stoppingToStopped);

  console.log(`[Simulator] Would execute: terraform destroy -var="instance_id=${instanceId}"`);
  console.log(`[Simulator] Removing Tailscale device...`);
  console.log(`[Simulator] Deleting Hetzner server...`);
  console.log(`[Simulator] Termination complete.`);

  await updateInstanceStatus(instanceId, {
    status: "stopped",
    stoppedAt: new Date(),
  });
}

/**
 * Utility to simulate delays
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
