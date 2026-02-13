/**
 * VM Provisioning Orchestrator
 * Coordinates Hetzner server creation, Tailscale enrollment, and cloud-init configuration
 */

import { createServer, waitForAction } from "../hetzner";
import { createAuthKey, verifyEnrollment } from "../tailscale";
import { generateCloudInitConfig } from "../cloud-init";

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
 * Provision a VM with Hetzner and Tailscale integration
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

  // 3. Create Tailscale ephemeral auth key
  console.log("[ProvisionVM] Creating Tailscale auth key...");
  const authKeyResponse = await createAuthKey();
  const authKey = authKeyResponse.key;
  console.log("[ProvisionVM] Tailscale auth key generated");

  // 4. Generate cloud-init config
  console.log("[ProvisionVM] Generating cloud-init configuration...");
  const cloudInitConfig = generateCloudInitConfig({
    tailscaleAuthKey: authKey,
    hostname: serverName,
  });
  console.log("[ProvisionVM] Cloud-init config generated");

  // 5. Read SSH key ID from environment
  const sshKeyId = process.env.HETZNER_SSH_KEY_ID;
  if (!sshKeyId) {
    throw new Error("[ProvisionVM] Missing HETZNER_SSH_KEY_ID environment variable");
  }

  // 6. Create Hetzner server
  console.log("[ProvisionVM] Creating Hetzner server...");
  const createResponse = await createServer({
    name: serverName,
    serverType: "cpx11",
    image: "ubuntu-22.04",
    location: mappedLocation,
    sshKeys: [parseInt(sshKeyId, 10)],
    userData: cloudInitConfig,
    labels: {
      provisioning_job_id: jobId,
      agent_id: agentId,
    },
  });

  const serverId = createResponse.server.id;
  const serverIp = createResponse.server.public_net.ipv4.ip;
  console.log(`[ProvisionVM] Hetzner server created: id=${serverId}, ip=${serverIp}`);

  // 7. Wait for Hetzner action completion
  console.log("[ProvisionVM] Waiting for server to be ready...");
  await waitForAction(createResponse.action.id);
  console.log("[ProvisionVM] Hetzner server is ready");

  // 8. Verify Tailscale enrollment
  console.log("[ProvisionVM] Verifying Tailscale enrollment...");
  const enrollment = await verifyEnrollment(serverName);
  console.log(`[ProvisionVM] Tailscale enrollment verified: ip=${enrollment.tailscaleIp}`);

  // 9. Return result
  const result: ProvisionVMResult = {
    serverId,
    serverIp,
    tailscaleIp: enrollment.tailscaleIp,
    serverName,
  };

  console.log("[ProvisionVM] Provisioning complete:", result);
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

    // Also write to GITHUB_OUTPUT for modern Actions
    const fs = await import("fs");
    const outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, `server_id=${result.serverId}\n`);
      fs.appendFileSync(outputFile, `server_ip=${result.serverIp}\n`);
      fs.appendFileSync(outputFile, `tailscale_ip=${result.tailscaleIp}\n`);
      fs.appendFileSync(outputFile, `server_name=${result.serverName}\n`);
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
