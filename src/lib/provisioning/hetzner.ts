import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
  // Map Aura LLM provider names to OpenClaw env var names
  const llmEnvVars: string[] = [];
  const provider = agentConfig.llmProvider ?? "openrouter";
  const isOpenRouter = provider === "openrouter";

  if (isOpenRouter) {
    // OpenRouter: single API key routes to any model
    if (process.env.OPENROUTER_API_KEY) {
      llmEnvVars.push(`OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY}`);
      llmEnvVars.push(`OPENAI_API_BASE=https://openrouter.ai/api/v1`);
      llmEnvVars.push(`OPENAI_API_KEY=${process.env.OPENROUTER_API_KEY}`);
    }
  } else {
    // Direct provider keys (BYOK)
    if (process.env.OPENAI_API_KEY) {
      llmEnvVars.push(`OPENAI_API_KEY=${process.env.OPENAI_API_KEY}`);
    }
    if (process.env.ANTHROPIC_API_KEY) {
      llmEnvVars.push(`ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`);
    }
    if (process.env.GOOGLE_API_KEY) {
      llmEnvVars.push(`GOOGLE_API_KEY=${process.env.GOOGLE_API_KEY}`);
    }
    if (process.env.GROQ_API_KEY) {
      llmEnvVars.push(`GROQ_API_KEY=${process.env.GROQ_API_KEY}`);
    }
    if (process.env.XAI_API_KEY) {
      llmEnvVars.push(`XAI_API_KEY=${process.env.XAI_API_KEY}`);
    }
  }

  // For OpenRouter, model is already in provider/model format (e.g. "anthropic/claude-sonnet-4.5")
  // For direct providers, combine provider + model
  const model = agentConfig.llmModel ?? (isOpenRouter ? "anthropic/claude-sonnet-4.5" : "gpt-4.1-mini");
  const openclawModel = isOpenRouter ? model : `${provider}/${model}`;

  // Build the system prompt from personality + goal
  const systemPromptParts: string[] = [];
  if (agentConfig.personality) {
    systemPromptParts.push(agentConfig.personality);
  }
  if (agentConfig.goal) {
    systemPromptParts.push(`Your goal: ${agentConfig.goal}`);
  }
  const systemPrompt = systemPromptParts.join("\n\n") || "You are a helpful AI assistant.";

  // Escape single quotes for YAML heredoc safety
  const escapedSystemPrompt = systemPrompt.replace(/'/g, "''");
  const escapedAgentName = (agentConfig.name || "Aura Agent").replace(/'/g, "''");

  const envFileContent = llmEnvVars.join("\\n");

  return `#cloud-config
package_update: true
package_upgrade: false

packages:
  - ufw
  - curl
  - debian-keyring
  - debian-archive-keyring
  - apt-transport-https

runcmd:
  # --- Firewall: only 443 (HTTPS) + 22 (SSH) ---
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp
  - ufw allow 443/tcp
  - ufw allow 80/tcp
  - ufw --force enable

  # --- Install Node.js 22 ---
  - curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  - apt-get install -y nodejs

  # --- Install OpenClaw ---
  - npm install -g openclaw@latest

  # --- Create OpenClaw home directory ---
  - mkdir -p /root/.openclaw

  # --- Write LLM environment variables ---
  - |
    cat > /root/.openclaw/.env << 'ENVEOF'
    ${envFileContent}
    OPENCLAW_INSTANCE_ID=${instanceId}
    ENVEOF

  # --- Write OpenClaw config (enable HTTP chat completions endpoint) ---
  - |
    cat > /root/.openclaw/openclaw.json << 'CFGEOF'
    {
      "agent": {
        "model": "${openclawModel}",
        "name": "${escapedAgentName}"
      },
      "gateway": {
        "auth": {
          "token": "${gatewayToken}"
        },
        "http": {
          "endpoints": {
            "chatCompletions": { "enabled": true }
          }
        }
      }
    }
    CFGEOF

  # --- Install Caddy for auto-HTTPS reverse proxy ---
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  - curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  - apt-get update
  - apt-get install -y caddy

  # --- Configure Caddy as reverse proxy to OpenClaw Gateway ---
  - |
    cat > /etc/caddy/Caddyfile << 'CADDYEOF'
    :443 {
      reverse_proxy localhost:18789
      tls internal
    }
    :80 {
      reverse_proxy localhost:18789
    }
    CADDYEOF
  - systemctl restart caddy

  # --- Create systemd service for OpenClaw Gateway ---
  - |
    cat > /etc/systemd/system/openclaw-gateway.service << 'SVCEOF'
    [Unit]
    Description=OpenClaw Gateway
    After=network-online.target
    Wants=network-online.target

    [Service]
    Type=simple
    User=root
    Environment=HOME=/root
    EnvironmentFile=/root/.openclaw/.env
    ExecStart=/usr/bin/openclaw gateway --port 18789
    Restart=always
    RestartSec=5

    [Install]
    WantedBy=multi-user.target
    SVCEOF
  - systemctl daemon-reload
  - systemctl enable openclaw-gateway
  - systemctl start openclaw-gateway

  # --- Signal that provisioning is complete ---
  - touch /root/.openclaw/.provisioned
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
 * Wait for the OpenClaw gateway to respond on the server.
 * Cloud-init installs Node.js, OpenClaw, and Caddy — this polls until the
 * gateway is actually reachable, not just until the VM boots.
 */
async function waitForGateway(
  serverIp: string,
  timeoutMs: number = 300_000 // 5 minutes — cloud-init can take a while
): Promise<void> {
  const start = Date.now();
  const pollIntervalMs = 5_000;

  console.log(`[Hetzner] Waiting for gateway at ${serverIp}:80 ...`);

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://${serverIp}:80/`, {
        signal: AbortSignal.timeout(4_000),
      });
      // 502 means Caddy is up but OpenClaw isn't running yet — keep waiting
      if (res.status === 502) {
        console.log(`[Hetzner] Gateway returned 502 (OpenClaw not ready yet)`);
      } else {
        console.log(`[Hetzner] Gateway responded with status ${res.status}`);
        return;
      }
    } catch {
      // Connection refused or timeout — cloud-init still running
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`Gateway at ${serverIp} did not become reachable within ${timeoutMs / 1000}s`);
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
  return message;
}

// ---------------------------------------------------------------------------
// Public API — drop-in replacements for simulator functions
// ---------------------------------------------------------------------------

/**
 * Provision a real Hetzner VM with OpenClaw installed via cloud-init.
 * Replaces simulateProvisioning() from simulator.ts.
 */
export async function provisionServer(instanceId: string): Promise<void> {
  console.log(`[Hetzner] Starting provisioning for instance ${instanceId}`);

  // Fetch agent config from the instance → agent relationship
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

  // Move to provisioning status
  await updateInstanceStatus(instanceId, { status: "provisioning" });

  try {
    // Generate a gateway auth token for the OpenClaw HTTP API
    const gatewayToken = randomBytes(32).toString("hex");

    // Generate cloud-init script
    const userData = generateCloudInit(agentConfig, instanceId, gatewayToken);

    // Create the Hetzner server
    console.log(`[Hetzner] Creating server in ${location} for agent "${agent.name}"`);
    const server = await createServer({
      name: `aura-${instanceId.slice(0, 8)}`,
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

    console.log(`[Hetzner] Server created: ${serverId} (${serverIp}), waiting for running status...`);

    // Update DB with server details immediately
    await updateInstanceStatus(instanceId, {
      serverId,
      serverIp,
    });

    // Store the gateway token on the agent config so the dashboard can proxy chat requests
    const existingConfig = (agent.config as Record<string, unknown>) ?? {};
    await db
      .update(agents)
      .set({
        config: { ...existingConfig, gatewayToken },
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agent.id));

    // Wait for server to boot
    await updateInstanceStatus(instanceId, { currentStep: "vm_created" });
    await waitForServerRunning(serverId);

    console.log(`[Hetzner] Server ${serverId} is running. Waiting for cloud-init and gateway...`);

    // Wait for cloud-init to finish and OpenClaw gateway to respond
    await updateInstanceStatus(instanceId, { currentStep: "ansible_started" });
    await waitForGateway(serverIp);

    await updateInstanceStatus(instanceId, { currentStep: "ansible_complete" });

    // Gateway is actually reachable — mark as running
    await updateInstanceStatus(instanceId, {
      status: "running",
      startedAt: new Date(),
    });

    console.log(`[Hetzner] Provisioning complete for instance ${instanceId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provisioning error";
    console.error(`[Hetzner] Provisioning failed for instance ${instanceId}:`, message);

    await updateInstanceStatus(instanceId, {
      status: "failed",
      error: friendlyHetznerError(message),
    });
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
