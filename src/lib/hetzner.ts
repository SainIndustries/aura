/**
 * Hetzner Cloud API client
 * Provides server creation, action polling, and deletion with rate limit handling
 */

interface HetznerConfig {
  token: string;
}

function getHetznerConfig(): HetznerConfig {
  const token = process.env.HETZNER_API_TOKEN;

  if (!token) {
    throw new Error("Missing HETZNER_API_TOKEN environment variable");
  }

  return { token };
}

export interface CreateServerConfig {
  name: string;
  serverType: string;
  image: string;
  location: string;
  sshKeys: number[];
  userData: string;
  labels: Record<string, string>;
}

export interface HetznerAction {
  id: number;
  status: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface CreateServerResponse {
  server: {
    id: number;
    name: string;
    public_net: {
      ipv4: {
        ip: string;
      };
    };
  };
  action: HetznerAction;
}

interface WaitForActionOptions {
  maxRetries?: number;
  intervalMs?: number;
}

/**
 * Fetch wrapper with rate limit retry logic
 * Handles HTTP 429 with exponential backoff
 */
export async function fetchWithRateLimit(
  url: string,
  options: RequestInit
): Promise<Response> {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    // Rate limited - calculate wait time
    attempt++;
    const rateLimitReset = response.headers.get("RateLimit-Reset");
    let waitMs: number;

    if (rateLimitReset) {
      const resetTime = parseInt(rateLimitReset, 10) * 1000;
      const now = Date.now();
      waitMs = Math.max(0, resetTime - now);
    } else {
      // Fallback to exponential backoff with jitter
      const backoff = Math.min(60000, 1000 * Math.pow(2, attempt - 1));
      const jitter = Math.random() * 1000;
      waitMs = backoff + jitter;
    }

    console.log(
      `[Hetzner] Rate limited (attempt ${attempt}/${maxRetries}), waiting ${Math.round(waitMs / 1000)}s...`
    );

    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw new Error(
    `[Hetzner] Rate limit exceeded after ${maxRetries} retries`
  );
}

/**
 * Create a new Hetzner Cloud server
 * @param config - Server configuration
 * @returns Promise<CreateServerResponse>
 * @throws Error if server creation fails
 */
export async function createServer(
  config: CreateServerConfig
): Promise<CreateServerResponse> {
  const { token } = getHetznerConfig();

  const url = "https://api.hetzner.cloud/v1/servers";

  const response = await fetchWithRateLimit(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: config.name,
      server_type: config.serverType,
      image: config.image,
      location: config.location,
      ssh_keys: config.sshKeys,
      user_data: config.userData,
      start_after_create: true,
      labels: config.labels,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const errorCode = data.error?.code || "unknown";
    const errorMessage = data.error?.message || response.statusText;
    throw new Error(
      `[Hetzner] Server creation failed: ${errorCode} - ${errorMessage}`
    );
  }

  console.log(
    `[Hetzner] Server ${config.name} created (ID: ${data.server.id}, IP: ${data.server.public_net.ipv4.ip})`
  );

  return data;
}

/**
 * Wait for a Hetzner action to complete
 * @param actionId - The action ID to wait for
 * @param options - Polling configuration
 * @throws Error if action fails or times out
 */
export async function waitForAction(
  actionId: number,
  options?: WaitForActionOptions
): Promise<void> {
  const { token } = getHetznerConfig();
  const maxRetries = options?.maxRetries ?? 120;
  const intervalMs = options?.intervalMs ?? 1000;

  const url = `https://api.hetzner.cloud/v1/actions/${actionId}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetchWithRateLimit(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      const errorCode = data.error?.code || "unknown";
      const errorMessage = data.error?.message || response.statusText;
      throw new Error(
        `[Hetzner] Action ${actionId} fetch failed: ${errorCode} - ${errorMessage}`
      );
    }

    const action = data.action as HetznerAction;

    if (action.status === "success") {
      console.log(`[Hetzner] Action ${actionId} completed successfully`);
      return;
    }

    if (action.status === "error") {
      const errorMessage =
        action.error?.message || "Unknown action error";
      throw new Error(
        `[Hetzner] Action ${actionId} failed: ${errorMessage}`
      );
    }

    // Still running, wait and poll again
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(
    `[Hetzner] Action ${actionId} timeout after ${maxRetries * intervalMs}ms`
  );
}

/**
 * Delete a Hetzner Cloud server
 * Idempotent: 404 responses are treated as success
 * @param serverId - The server ID to delete
 * @throws Error if deletion fails (non-404 errors)
 */
export async function deleteServer(serverId: number): Promise<void> {
  const { token } = getHetznerConfig();

  const url = `https://api.hetzner.cloud/v1/servers/${serverId}`;

  const response = await fetchWithRateLimit(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // Idempotent: 404 means server already deleted
  if (response.status === 404) {
    console.log(`[Hetzner] Server ${serverId} already deleted (404)`);
    return;
  }

  if (!response.ok) {
    const data = await response.json();
    const errorCode = data.error?.code || "unknown";
    const errorMessage = data.error?.message || response.statusText;
    throw new Error(
      `[Hetzner] Server ${serverId} deletion failed: ${errorCode} - ${errorMessage}`
    );
  }

  console.log(`[Hetzner] Server ${serverId} deleted successfully`);
}

/**
 * Gracefully shutdown a Hetzner Cloud server via ACPI
 * Falls back to forced poweroff on timeout
 * @param serverId - The server ID to shutdown
 * @throws Error if shutdown fails
 */
export async function shutdownServer(serverId: number): Promise<void> {
  const { token } = getHetznerConfig();

  const url = `https://api.hetzner.cloud/v1/servers/${serverId}/actions/shutdown`;

  const response = await fetchWithRateLimit(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const errorCode = data.error?.code || "unknown";
    const errorMessage = data.error?.message || response.statusText;
    throw new Error(
      `[Hetzner] Server ${serverId} shutdown failed: ${errorCode} - ${errorMessage}`
    );
  }

  const action = data.action as HetznerAction;

  try {
    // Wait up to 60 seconds for graceful shutdown
    await waitForAction(action.id, { maxRetries: 60, intervalMs: 1000 });
    console.log(`[Hetzner] Server ${serverId} shut down gracefully`);
  } catch (error) {
    console.warn(
      `[Hetzner] Graceful shutdown timeout for server ${serverId}, falling back to forced poweroff`
    );
    await powerOffServer(serverId);
  }
}

/**
 * Power on a Hetzner Cloud server
 * @param serverId - The server ID to power on
 * @throws Error if power on fails
 */
export async function powerOnServer(serverId: number): Promise<void> {
  const { token } = getHetznerConfig();

  const url = `https://api.hetzner.cloud/v1/servers/${serverId}/actions/poweron`;

  const response = await fetchWithRateLimit(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const errorCode = data.error?.code || "unknown";
    const errorMessage = data.error?.message || response.statusText;
    throw new Error(
      `[Hetzner] Server ${serverId} power on failed: ${errorCode} - ${errorMessage}`
    );
  }

  const action = data.action as HetznerAction;
  await waitForAction(action.id);

  console.log(`[Hetzner] Server ${serverId} powered on`);
}

/**
 * Forcefully power off a Hetzner Cloud server
 * WARNING: This may cause data loss. Use shutdownServer() for graceful shutdown.
 * @param serverId - The server ID to power off
 * @throws Error if power off fails
 */
export async function powerOffServer(serverId: number): Promise<void> {
  const { token } = getHetznerConfig();

  const url = `https://api.hetzner.cloud/v1/servers/${serverId}/actions/poweroff`;

  const response = await fetchWithRateLimit(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const errorCode = data.error?.code || "unknown";
    const errorMessage = data.error?.message || response.statusText;
    throw new Error(
      `[Hetzner] Server ${serverId} power off failed: ${errorCode} - ${errorMessage}`
    );
  }

  const action = data.action as HetznerAction;
  await waitForAction(action.id);

  console.log(`[Hetzner] Server ${serverId} forced power off`);
}
