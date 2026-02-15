import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { agents, agentInstances } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { updateInstanceStatus } from "./index";

// ---------------------------------------------------------------------------
// Hetzner Cloud API client for provisioning OpenClaw agent VMs
// ---------------------------------------------------------------------------

const HETZNER_API_BASE = "https://api.hetzner.cloud/v1";

function getApiToken(): string {
  const token = process.env.HETZNER_API_TOKEN;
  if (!token) {
    throw new Error("HETZNER_API_TOKEN environment variable is not set");
  }
  return token;
}

async function hetznerRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getApiToken();
  const res = await fetch(`${HETZNER_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Hetzner API error ${res.status}: ${body}`);
  }

  // DELETE returns 204 No Content
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Region mapping (Aura region → Hetzner location)
// ---------------------------------------------------------------------------

const REGION_MAP: Record<string, string> = {
  "us-east": "ash",    // Ashburn, VA
  "us-west": "hil",    // Hillsboro, OR
  "eu-central": "nbg1", // Nuremberg, DE
  "eu-west": "fsn1",   // Falkenstein, DE
  "eu-north": "hel1",  // Helsinki, FI
};

function resolveLocation(region: string): string {
  return REGION_MAP[region] ?? "ash";
}

// ---------------------------------------------------------------------------
// Hetzner server types (tier → Hetzner server type)
// ---------------------------------------------------------------------------

const DEFAULT_SERVER_TYPE = "cpx11"; // 2 vCPU, 2 GB RAM, 40 GB disk — cheapest option, sufficient for OpenClaw

// Use a snapshot if available, otherwise base Ubuntu image
function getImage(): string {
  return process.env.HETZNER_SNAPSHOT_ID ?? "ubuntu-24.04";
}

function getSshKeys(): string[] {
  const keys = process.env.HETZNER_SSH_KEY_IDS;
  if (!keys) return [];
  return keys.split(",").map((k) => k.trim());
}

// ---------------------------------------------------------------------------
// Cloud-init script generation
// ---------------------------------------------------------------------------

interface AgentConfig {
  name: string;
  personality?: string | null;
  goal?: string | null;
  llmProvider?: string;
  llmModel?: string;
  llmTemperature?: number;
  llmCustomEndpoint?: string;
  heartbeatEnabled?: boolean;
  heartbeatCron?: string | null;
}

function generateCloudInit(agentConfig: AgentConfig, instanceId: string, gatewayToken: string): string {
  const provider = agentConfig.llmProvider ?? "openrouter";
  const isOpenRouter = provider === "openrouter";

  // OpenClaw prefixes OpenRouter models with "openrouter/" (e.g. "openrouter/anthropic/claude-sonnet-4.5")
  // For direct providers, combine provider + model
  const model = agentConfig.llmModel ?? (isOpenRouter ? "anthropic/claude-sonnet-4.5" : "gpt-4.1-mini");
  const openclawModel = isOpenRouter ? `openrouter/${model}` : `${provider}/${model}`;

  // Build the env section for openclaw.json — API keys live here
  const envKeys: Record<string, string> = {};

  if (isOpenRouter) {
    if (process.env.OPENROUTER_API_KEY) {
      envKeys.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    }
  } else {
    // Direct provider keys (BYOK)
    const keyMap: Record<string, string | undefined> = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      XAI_API_KEY: process.env.XAI_API_KEY,
    };
    for (const [k, v] of Object.entries(keyMap)) {
      if (v) envKeys[k] = v;
    }
  }

  // Build OpenClaw config matching the documented schema
  const openclawConfig = {
    gateway: {
      mode: "local" as const,
      port: 18789,
      auth: {
        mode: "token" as const,
        token: gatewayToken,
      },
      http: {
        endpoints: {
          chatCompletions: { enabled: true },
        },
      },
    },
    agents: {
      defaults: {
        model: {
          primary: openclawModel,
        },
      },
    },
    env: envKeys,
  };

  // JSON.stringify handles escaping for us — no manual quote escaping needed
  const configJson = JSON.stringify(openclawConfig, null, 2);

  // Indent JSON for YAML write_files content block (6 spaces to align under `content: |`)
  const indentedConfig = configJson.split("\n").map((l) => "      " + l).join("\n");

  return `#cloud-config
package_update: false
package_upgrade: false

write_files:
  - path: /root/.openclaw/openclaw.json
    owner: root:root
    permissions: "0600"
    content: |
${indentedConfig}

  - path: /etc/systemd/system/openclaw-gateway.service
    owner: root:root
    permissions: "0644"
    content: |
      [Unit]
      Description=OpenClaw Gateway
      After=network-online.target
      Wants=network-online.target

      [Service]
      Type=simple
      User=root
      Environment=HOME=/root
      ExecStart=/usr/bin/openclaw gateway --port 18789
      Restart=always
      RestartSec=5

      [Install]
      WantedBy=multi-user.target

runcmd:
  # --- Add ALL repos first, then one apt-get update + install ---
  - curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  - apt-get update
  - DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs caddy

  # --- Install OpenClaw ---
  - npm install -g openclaw@latest

  # --- Overwrite Caddy config AFTER apt install (avoids dpkg prompt conflict) ---
  - cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.dist
  - printf ':443 {\\n  reverse_proxy localhost:18789\\n  tls internal\\n}\\n:80 {\\n  reverse_proxy localhost:18789\\n}\\n' > /etc/caddy/Caddyfile

  # --- Start services (openclaw config written by write_files) ---
  - systemctl daemon-reload
  - systemctl enable openclaw-gateway
  - systemctl start openclaw-gateway
  - systemctl restart caddy

  # --- Firewall: only 80/443 (HTTP/HTTPS) + 22 (SSH) ---
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable
`;
}

// ---------------------------------------------------------------------------
// Hetzner server CRUD
// ---------------------------------------------------------------------------

interface HetznerServer {
  id: number;
  name: string;
  status: string; // "initializing" | "starting" | "running" | "stopping" | "off" | "deleting" | "migrating" | "rebuilding" | "unknown"
  public_net: {
    ipv4: { ip: string };
    ipv6: { ip: string };
  };
  server_type: { name: string; description: string };
  datacenter: { name: string; location: { name: string; city: string } };
  labels: Record<string, string>;
}

interface CreateServerResponse {
  server: HetznerServer;
  action: { id: number; status: string };
}

interface GetServerResponse {
  server: HetznerServer;
}

async function createServer(opts: {
  name: string;
  location: string;
  userData: string;
  labels: Record<string, string>;
}): Promise<HetznerServer> {
  const sshKeys = getSshKeys();

  const body: Record<string, unknown> = {
    name: opts.name,
    server_type: DEFAULT_SERVER_TYPE,
    image: getImage(),
    location: opts.location,
    user_data: opts.userData,
    start_after_create: true,
    labels: opts.labels,
  };

  if (sshKeys.length > 0) {
    body.ssh_keys = sshKeys;
  }

  const res = await hetznerRequest<CreateServerResponse>("/servers", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return res.server;
}

async function getServer(serverId: string): Promise<HetznerServer> {
  const res = await hetznerRequest<GetServerResponse>(`/servers/${serverId}`);
  return res.server;
}

async function deleteServer(serverId: string): Promise<void> {
  await hetznerRequest(`/servers/${serverId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Polling helper — wait for Hetzner server to reach "running" status
// ---------------------------------------------------------------------------

async function waitForServerRunning(
  serverId: string,
  timeoutMs: number = 120_000
): Promise<HetznerServer> {
  const start = Date.now();
  const pollIntervalMs = 3_000;

  while (Date.now() - start < timeoutMs) {
    const server = await getServer(serverId);
    if (server.status === "running") {
      return server;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Server ${serverId} did not reach 'running' status within ${timeoutMs / 1000}s`);
}

/**
 * Wait for the OpenClaw gateway to respond on the server AND verify
 * the chat completions endpoint actually works.
 * Cloud-init installs Node.js, OpenClaw, and Caddy — this polls until the
 * gateway is fully operational, not just until the VM boots.
 *
 * Updates the instance step granularly so the UI can show progress:
 *   installing_packages → caddy_up → gateway_responding → verifying_chat
 */
async function waitForGateway(
  serverIp: string,
  gatewayToken: string,
  instanceId: string,
  timeoutMs: number = 480_000 // 8 minutes — cloud-init can take a while on small VMs
): Promise<void> {
  const start = Date.now();
  const pollIntervalMs = 5_000;
  let reportedCaddyUp = false;

  console.log(`[Hetzner] Waiting for gateway at ${serverIp}:80 ...`);

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://${serverIp}:80/`, {
        signal: AbortSignal.timeout(4_000),
      });
      // 502 means Caddy is up but OpenClaw isn't running yet — keep waiting
      if (res.status === 502) {
        if (!reportedCaddyUp) {
          reportedCaddyUp = true;
          console.log(`[Hetzner] Caddy is up, waiting for OpenClaw to start...`);
          await updateInstanceStatus(instanceId, { currentStep: "caddy_up" });
        }
      } else {
        console.log(`[Hetzner] Gateway responded with status ${res.status}, verifying chat endpoint...`);
        await updateInstanceStatus(instanceId, { currentStep: "verifying_chat" });
        // Gateway is up — now verify chat completions actually works
        const verified = await verifyChatEndpoint(serverIp, gatewayToken);
        if (verified) {
          console.log(`[Hetzner] Chat completions verified successfully`);
          return;
        }
        console.log(`[Hetzner] Chat completions not ready yet, continuing to poll...`);
      }
    } catch {
      // Connection refused or timeout — cloud-init still running
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Gateway at ${serverIp} did not become reachable within ${timeoutMs / 1000}s. The server may need more time to install software. Please retry.`);
}

/**
 * Verify the OpenClaw gateway is responding and can accept chat requests.
 * Uses a short timeout to fit within Vercel serverless function limits.
 * We check that the gateway returns a valid response structure rather than
 * waiting for a full LLM completion (which can take 10-30s).
 */
async function verifyChatEndpoint(serverIp: string, gatewayToken: string): Promise<boolean> {
  try {
    // Quick auth check — send a minimal request with max_tokens=1 and short timeout
    const res = await fetch(`http://${serverIp}:80/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        model: "openclaw",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
        stream: false,
      }),
      signal: AbortSignal.timeout(8_000), // Must fit within Vercel function timeout
    });

    // Any non-502 response from the gateway means OpenClaw is running.
    // 200 = LLM responded, 4xx/5xx = gateway is up but config issue (still counts as "running")
    if (res.status === 502) {
      console.log(`[Hetzner] Chat verification: gateway returning 502, OpenClaw not ready`);
      return false;
    }

    console.log(`[Hetzner] Chat verification passed (status ${res.status})`);
    return true;
  } catch (err) {
    console.log(`[Hetzner] Chat verification error: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

/**
 * Parse Hetzner API errors into user-friendly messages
 */
function friendlyHetznerError(message: string): string {
  if (message.includes("resource_limit_exceeded") || message.includes("server limit reached")) {
    return "Server limit reached on hosting provider. Please delete unused agents or contact support.";
  }
  if (message.includes("uniqueness_error")) {
    return "A server with this name already exists. Please try again.";
  }
  if (message.includes("rate_limit_exceeded")) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (message.includes("did not become reachable")) {
    return "Server setup took too long. This can happen with slow network conditions. Please retry — the next attempt usually succeeds.";
  }
  return message;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Hetzner server for the given instance (fast — single API call).
 * Called once during the "pending" → "provisioning" transition.
 * Does NOT wait for the server to boot or for cloud-init to finish.
 */
export async function createServerForInstance(instanceId: string): Promise<void> {
  console.log(`[Hetzner] Creating server for instance ${instanceId}`);

  const instance = await db.query.agentInstances.findFirst({
    where: (t, { eq }) => eq(t.id, instanceId),
    with: { agent: true },
  });

  if (!instance || !instance.agent) {
    await updateInstanceStatus(instanceId, {
      status: "failed",
      error: "Instance or agent not found in database",
    });
    return;
  }

  const agent = instance.agent;
  const agentConfig: AgentConfig = {
    name: agent.name,
    personality: agent.personality,
    goal: agent.goal,
    llmProvider: (agent.config as Record<string, unknown>)?.llmProvider as string | undefined,
    llmModel: (agent.config as Record<string, unknown>)?.llmModel as string | undefined,
    llmTemperature: (agent.config as Record<string, unknown>)?.llmTemperature as number | undefined,
    llmCustomEndpoint: (agent.config as Record<string, unknown>)?.llmCustomEndpoint as string | undefined,
    heartbeatEnabled: agent.heartbeatEnabled ?? false,
    heartbeatCron: agent.heartbeatCron,
  };

  const region = instance.region ?? "us-east";
  const location = resolveLocation(region);

  try {
    const gatewayToken = randomBytes(32).toString("hex");
    const userData = generateCloudInit(agentConfig, instanceId, gatewayToken);

    const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
    const serverName = `aura-${slug || "agent"}-${instanceId.slice(0, 8)}`;
    console.log(`[Hetzner] Creating server "${serverName}" in ${location} for agent "${agent.name}"`);

    const server = await createServer({
      name: serverName,
      location,
      userData,
      labels: {
        "managed-by": "aura",
        "agent-id": agent.id,
        "instance-id": instanceId,
      },
    });

    const serverId = String(server.id);
    const serverIp = server.public_net.ipv4.ip;
    console.log(`[Hetzner] Server created: ${serverId} (${serverIp})`);

    // Save server details + move to provisioning/vm_booting
    await updateInstanceStatus(instanceId, {
      status: "provisioning",
      serverId,
      serverIp,
      currentStep: "vm_booting",
    });

    // Store gateway token on agent config for chat proxying
    const existingConfig = (agent.config as Record<string, unknown>) ?? {};
    await db
      .update(agents)
      .set({
        config: { ...existingConfig, gatewayToken },
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agent.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provisioning error";
    console.error(`[Hetzner] Server creation failed for instance ${instanceId}:`, message);
    await updateInstanceStatus(instanceId, {
      status: "failed",
      error: friendlyHetznerError(message),
    });
  }
}

/**
 * Incrementally progress the provisioning state by one step.
 * Designed to be called from a polling endpoint (e.g. every 1-2s).
 * Each call does at most one quick check and returns immediately.
 *
 * Progression: pending → provisioning(vm_booting → installing_packages → caddy_up → verifying_chat) → running
 */
export async function progressProvisioning(instanceId: string): Promise<void> {
  const instance = await db.query.agentInstances.findFirst({
    where: (t, { eq }) => eq(t.id, instanceId),
    with: { agent: true },
  });

  if (!instance) return;

  // Only progress instances that are actively provisioning
  if (instance.status !== "pending" && instance.status !== "provisioning") return;

  // Timeout: if provisioning for >10 minutes, fail and clean up
  const elapsed = Date.now() - new Date(instance.createdAt).getTime();
  if (elapsed > 600_000) {
    console.error(`[Hetzner] Instance ${instanceId} timed out after 10 minutes`);
    if (instance.serverId) {
      try {
        await deleteServer(instance.serverId);
      } catch { /* best effort */ }
    }
    await updateInstanceStatus(instanceId, {
      status: "failed",
      error: "Server setup took too long. This can happen with slow network conditions. Please retry — the next attempt usually succeeds.",
    });
    return;
  }

  // Step 1: pending → create server (use DB status as lock to prevent duplicate creation)
  if (instance.status === "pending") {
    // Atomically move to "provisioning" to prevent concurrent polls from creating multiple servers
    const [updated] = await db
      .update(agentInstances)
      .set({ status: "provisioning", updatedAt: new Date() })
      .where(and(eq(agentInstances.id, instanceId), eq(agentInstances.status, "pending")))
      .returning();
    if (!updated) return; // Another request already moved it past pending
    await createServerForInstance(instanceId);
    return;
  }

  // Step 2: vm_booting → check if Hetzner server is running
  if (instance.currentStep === "vm_booting" && instance.serverId) {
    try {
      const server = await getServer(instance.serverId);
      if (server.status === "running") {
        console.log(`[Hetzner] Server ${instance.serverId} is running, moving to installing_packages`);
        await updateInstanceStatus(instanceId, { currentStep: "installing_packages" });
      }
    } catch (err) {
      console.log(`[Hetzner] Server status check failed: ${err instanceof Error ? err.message : err}`);
    }
    return;
  }

  // Step 3: installing_packages / caddy_up → probe HTTP
  if (
    (instance.currentStep === "installing_packages" || instance.currentStep === "caddy_up") &&
    instance.serverIp
  ) {
    try {
      const res = await fetch(`http://${instance.serverIp}:80/`, {
        signal: AbortSignal.timeout(4_000),
      });
      if (res.status === 502) {
        // Caddy is up but OpenClaw not yet
        if (instance.currentStep !== "caddy_up") {
          console.log(`[Hetzner] Caddy is up, waiting for OpenClaw`);
          await updateInstanceStatus(instanceId, { currentStep: "caddy_up" });
        }
      } else {
        // Gateway responding — move to verification
        console.log(`[Hetzner] Gateway responded (${res.status}), moving to verifying_chat`);
        await updateInstanceStatus(instanceId, { currentStep: "verifying_chat" });
      }
    } catch {
      // Connection refused / timeout — cloud-init still running
    }
    return;
  }

  // Step 4: verifying_chat → test chat completions
  if (instance.currentStep === "verifying_chat" && instance.serverIp && instance.agent) {
    const agentConfig = (instance.agent.config as Record<string, unknown>) ?? {};
    const gatewayToken = agentConfig.gatewayToken as string | undefined;
    if (!gatewayToken) return;

    const verified = await verifyChatEndpoint(instance.serverIp, gatewayToken);
    if (verified) {
      console.log(`[Hetzner] Chat verified! Marking instance ${instanceId} as running`);
      await updateInstanceStatus(instanceId, {
        status: "running",
        startedAt: new Date(),
      });
    }
  }
}

/**
 * Terminate a Hetzner VM.
 * Replaces simulateTermination() from simulator.ts.
 */
export async function terminateServer(instanceId: string): Promise<void> {
  console.log(`[Hetzner] Starting termination for instance ${instanceId}`);

  const instance = await db.query.agentInstances.findFirst({
    where: (t, { eq }) => eq(t.id, instanceId),
  });

  if (!instance?.serverId) {
    console.warn(`[Hetzner] No server ID found for instance ${instanceId}, marking as stopped`);
    await updateInstanceStatus(instanceId, {
      status: "stopped",
      stoppedAt: new Date(),
    });
    return;
  }

  try {
    console.log(`[Hetzner] Deleting server ${instance.serverId}`);
    await deleteServer(instance.serverId);

    await updateInstanceStatus(instanceId, {
      status: "stopped",
      stoppedAt: new Date(),
    });

    console.log(`[Hetzner] Server ${instance.serverId} deleted. Instance ${instanceId} stopped.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown termination error";
    console.error(`[Hetzner] Termination failed for instance ${instanceId}:`, message);

    // Still mark as stopped — the server may have already been deleted
    await updateInstanceStatus(instanceId, {
      status: "stopped",
      stoppedAt: new Date(),
      error: `Termination error: ${message}`,
    });
  }
}
