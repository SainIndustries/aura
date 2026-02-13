/**
 * Tailscale API client
 * Handles OAuth token acquisition, ephemeral auth key generation, and device enrollment verification
 */

interface TailscaleConfig {
  clientId: string;
  clientSecret: string;
}

function getTailscaleConfig(): TailscaleConfig {
  const clientId = process.env.TAILSCALE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.TAILSCALE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Tailscale configuration. Required: TAILSCALE_OAUTH_CLIENT_ID, TAILSCALE_OAUTH_CLIENT_SECRET"
    );
  }

  return { clientId, clientSecret };
}

interface OAuthTokenResponse {
  access_token: string;
}

export interface TailscaleDevice {
  id: string;
  hostname: string;
  addresses: string[];
}

export interface TailscaleEnrollmentResult {
  tailscaleIp: string;
  deviceId: string;
}

interface VerifyEnrollmentOptions {
  maxRetries?: number;
  intervalMs?: number;
}

/**
 * Get OAuth access token for Tailscale API
 * @returns Promise<{ access_token: string }>
 * @throws Error if OAuth token acquisition fails
 */
export async function getOAuthToken(): Promise<OAuthTokenResponse> {
  const { clientId, clientSecret } = getTailscaleConfig();

  const url = "https://api.tailscale.com/api/v2/oauth/token";

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `[Tailscale] OAuth token acquisition failed: ${response.status} ${JSON.stringify(data)}`
    );
  }

  return data;
}

/**
 * Create an ephemeral auth key for device enrollment
 * @returns Promise<{ key: string }>
 * @throws Error if auth key creation fails
 */
export async function createAuthKey(): Promise<{ key: string }> {
  const tokenResponse = await getOAuthToken();
  const accessToken = tokenResponse.access_token;

  const url = "https://api.tailscale.com/api/v2/tailnet/-/keys";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      capabilities: {
        devices: {
          create: {
            reusable: false,
            ephemeral: true,
            preauthorized: true,
            tags: ["tag:agent"],
          },
        },
      },
      expirySeconds: 3600,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `[Tailscale] Auth key creation failed: ${response.status} ${JSON.stringify(data)}`
    );
  }

  console.log("[Tailscale] Created ephemeral auth key for device enrollment");

  return data;
}

/**
 * Verify that a device has enrolled in Tailscale
 * Polls device list until hostname appears with assigned IP
 * @param hostname - The device hostname to verify
 * @param options - Polling configuration
 * @returns Promise<TailscaleEnrollmentResult>
 * @throws Error if enrollment times out
 */
export async function verifyEnrollment(
  hostname: string,
  options?: VerifyEnrollmentOptions
): Promise<TailscaleEnrollmentResult> {
  const maxRetries = options?.maxRetries ?? 60;
  const intervalMs = options?.intervalMs ?? 2000;

  const tokenResponse = await getOAuthToken();
  const accessToken = tokenResponse.access_token;

  const url = "https://api.tailscale.com/api/v2/tailnet/-/devices";

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `[Tailscale] Device list fetch failed: ${response.status} ${JSON.stringify(data)}`
      );
    }

    const devices = data.devices as TailscaleDevice[];
    const device = devices.find((d) => d.hostname === hostname);

    if (device && device.addresses && device.addresses.length > 0) {
      console.log(
        `[Tailscale] Device ${hostname} enrolled successfully (IP: ${device.addresses[0]})`
      );
      return {
        tailscaleIp: device.addresses[0],
        deviceId: device.id,
      };
    }

    // Not enrolled yet, wait and poll again
    if (attempt < maxRetries - 1) {
      if (attempt % 10 === 0) {
        console.log(
          `[Tailscale] Waiting for ${hostname} enrollment (attempt ${attempt + 1}/${maxRetries})...`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw new Error(
    `[Tailscale] Enrollment timeout for ${hostname} after ${maxRetries * intervalMs}ms`
  );
}
