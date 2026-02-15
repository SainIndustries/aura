/**
 * VM Provisioning Orchestrator
 * Coordinates Hetzner server creation, Tailscale enrollment, and cloud-init configuration
 * 
 * Supports two provisioning modes:
 * 1. Snapshot mode (fast): Uses pre-baked HETZNER_SNAPSHOT_ID + lightweight Ansible
 * 2. Fallback mode (slow): Uses ubuntu-22.04 base image + full Ansible configuration
 * 
 * Both modes use Ansible for agent-specific configuration, but snapshot mode
 * skips the slow infrastructure setup (Docker, Node.js, security hardening).
 */

import { createServer, waitForAction } from "../hetzner";
import { createAuthKey, verifyEnrollment } from "../tailscale";
import { generateCloudInitConfig, generateSnapshotCloudInitConfig } from "../cloud-init";

export interface ProvisionVMParams {
  jobId: string;
  agentId: string;
  region: string;
}

export interface ProvisionVMResult {
  serverId: number;
  serverIp: string;
  tailscaleIp: string;
  serverName: string;
  /** Whether snapshot mode was used (true) or fallback to base image (false) */
  usedSnapshot: boolean;
}

/**
 * Region to Hetzner location mapping
 * Maps user-friendly region names to Hetzner datacenter location codes
 */
const REGION_TO_LOCATION_MAP: Record<string, string> = {
  "us-east": "ash", // Ashburn, VA
  "eu-central": "nbg1", // Nuremberg, Germany
  "eu-west": "fsn1", // Falkenstein, Germany
  "ap-southeast": "sin", // Singapore
};

/**
 * Get the image to use for provisioning
 * Returns snapshot ID if available, otherwise falls back to ubuntu-22.04
 */
function getProvisioningImage(): { image: string; isSnapshot: boolean } {
  const snapshotId = process.env.HETZNER_SNAPSHOT_ID;
  
  if (snapshotId && snapshotId.trim() !== "") {
    console.log(`[ProvisionVM] Using snapshot image: ${snapshotId}`);
    return { image: snapshotId, isSnapshot: true };
  }
  
  console.log("[ProvisionVM] No snapshot configured, falling back to ubuntu-22.04");
  return { image: "ubuntu-22.04", isSnapshot: false };
}

/**
 * Provision a VM with Hetzner and Tailscale integration
 * 
 * Hybrid provisioning model:
 * - Snapshot provides: Docker, Node.js 20, fail2ban, UFW, openclaw user
 * - Cloud-init provides: Tailscale enrollment
 * - Ansible provides: Agent-specific config (env vars, service setup)
 * 
 * This gives speed from snapshot + flexibility from Ansible.
 * 
 * @param params - Provisioning parameters
 * @returns Promise<ProvisionVMResult>
 * @throws Error if any provisioning step fails
 */
export async function provisionVM(
  params: ProvisionVMParams
): Promise<ProvisionVMResult> {
  const { jobId, agentId, region } = params;

  // 1. Generate unique server name
  const serverName = `agent-${agentId.slice(0, 8)}-${Date.now()}`;
  console.log(`[ProvisionVM] Starting provisioning for ${serverName}`);

  // 2. Map region to Hetzner location
  const mappedLocation = REGION_TO_LOCATION_MAP[region] || "nbg1";
  console.log(`[ProvisionVM] Mapped region ${region} to location ${mappedLocation}`);

  // 3. Determine image to use (snapshot or base)
  const { image, isSnapshot } = getProvisioningImage();

  // 4. Get Tailscale auth key (pre-generated or dynamic)
  let authKey: string;
  const preGeneratedKey = process.env.TAILSCALE_AUTH_KEY;
  
  if (preGeneratedKey) {
    console.log("[ProvisionVM] Using pre-generated Tailscale auth key");
    authKey = preGeneratedKey;
  } else {
    console.log("[ProvisionVM] Creating Tailscale auth key via OAuth...");
    const authKeyResponse = await createAuthKey();
    authKey = authKeyResponse.key;
    console.log("[ProvisionVM] Tailscale auth key generated");
  }

  // 5. Generate appropriate cloud-init config
  console.log("[ProvisionVM] Generating cloud-init configuration...");
  let cloudInitConfig: string;
  
  if (isSnapshot) {
    // Snapshot mode: Tailscale already installed, just enroll
    cloudInitConfig = generateSnapshotCloudInitConfig({
      tailscaleAuthKey: authKey,
      hostname: serverName,
    });
    console.log("[ProvisionVM] Generated snapshot-mode cloud-init (Tailscale enrollment only)");
  } else {
    // Fallback mode: Install Tailscale from scratch
    cloudInitConfig = generateCloudInitConfig({
      tailscaleAuthKey: authKey,
      hostname: serverName,
    });
    console.log("[ProvisionVM] Generated fallback-mode cloud-init (Tailscale install)");
  }

  // 6. Read SSH key ID from environment
  const sshKeyId = process.env.HETZNER_SSH_KEY_ID;
  if (!sshKeyId) {
    throw new Error("[ProvisionVM] Missing HETZNER_SSH_KEY_ID environment variable");
  }

  // 7. Create Hetzner server
  console.log(`[ProvisionVM] Creating Hetzner server with image: ${image}...`);
  const createResponse = await createServer({
    name: serverName,
    serverType: "cpx11",
    image: image,
    location: mappedLocation,
    sshKeys: [parseInt(sshKeyId, 10)],
    userData: cloudInitConfig,
    labels: {
      provisioning_job_id: jobId,
      agent_id: agentId,
      provisioning_mode: isSnapshot ? "snapshot-hybrid" : "full",
    },
  });

  const serverId = createResponse.server.id;
  const serverIp = createResponse.server.public_net.ipv4.ip;
  console.log(`[ProvisionVM] Hetzner server created: id=${serverId}, ip=${serverIp}`);

  // 8. Wait for Hetzner action completion
  console.log("[ProvisionVM] Waiting for server to be ready...");
  await waitForAction(createResponse.action.id);
  console.log("[ProvisionVM] Hetzner server is ready");

  // 9. Verify Tailscale enrollment
  console.log("[ProvisionVM] Verifying Tailscale enrollment...");
  const enrollment = await verifyEnrollment(serverName);
  console.log(`[ProvisionVM] Tailscale enrollment verified: ip=${enrollment.tailscaleIp}`);

  // 10. Return result (Ansible will handle agent config)
  const result: ProvisionVMResult = {
    serverId,
    serverIp,
    tailscaleIp: enrollment.tailscaleIp,
    serverName,
    usedSnapshot: isSnapshot,
  };

  console.log("[ProvisionVM] VM provisioning complete, Ansible will configure agent");
  console.log("[ProvisionVM] Result:", result);
  return result;
}

// CLI entry point for GitHub Actions
async function main() {
  const jobId = process.env.JOB_ID;
  const agentId = process.env.AGENT_ID;
  const region = process.env.REGION || "us-east";

  if (!jobId || !agentId) {
    console.error("Missing required env vars: JOB_ID, AGENT_ID");
    process.exit(1);
  }

  try {
    const result = await provisionVM({ jobId, agentId, region });

    // Output for GitHub Actions to capture
    console.log(`::set-output name=server_id::${result.serverId}`);
    console.log(`::set-output name=server_ip::${result.serverIp}`);
    console.log(`::set-output name=tailscale_ip::${result.tailscaleIp}`);
    console.log(`::set-output name=server_name::${result.serverName}`);
    console.log(`::set-output name=used_snapshot::${result.usedSnapshot}`);

    // Also write to GITHUB_OUTPUT for modern Actions
    const fs = await import("fs");
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, `server_id=${result.serverId}\n`);
      fs.appendFileSync(outputFile, `server_ip=${result.serverIp}\n`);
      fs.appendFileSync(outputFile, `tailscale_ip=${result.tailscaleIp}\n`);
      fs.appendFileSync(outputFile, `server_name=${result.serverName}\n`);
      fs.appendFileSync(outputFile, `used_snapshot=${result.usedSnapshot}\n`);
    }
  } catch (error) {
    console.error("[ProvisionVM] Fatal error:", error);
    process.exit(1);
  }
}

// Run as CLI when executed directly
const isMainModule =
  typeof require !== "undefined"
    ? require.main === module
    : process.argv[1]?.includes("provision-vm");
if (isMainModule) {
  main();
}
