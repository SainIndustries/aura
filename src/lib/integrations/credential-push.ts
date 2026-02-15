/**
 * Push Google OAuth credentials to a running OpenClaw VM.
 *
 * After a user completes the Google OAuth flow on Aura, we push the
 * decrypted tokens to every running agent instance so the OpenClaw
 * Google Workspace skill can use them natively.
 */

import { db } from "@/lib/db";
import { agents, agentInstances, integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decryptToken } from "./encryption";

interface CredentialPayload {
  email: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Push Google credentials to a specific VM via its credential receiver endpoint.
 * Returns true if the push succeeded.
 */
async function pushToVm(
  serverIp: string,
  gatewayToken: string,
  payload: CredentialPayload,
): Promise<boolean> {
  try {
    const res = await fetch(
      `http://${serverIp}/internal/google-credentials`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${gatewayToken}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      console.error(`[cred-push] Failed to push to ${serverIp}: ${res.status} ${text}`);
      return false;
    }
    console.log(`[cred-push] Pushed Google credentials to ${serverIp}`);
    return true;
  } catch (err) {
    console.error(`[cred-push] Error pushing to ${serverIp}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Push Google credentials to ALL running agent instances for a given user.
 * Called after OAuth callback stores tokens in the DB.
 */
export async function pushGoogleCredentialsToRunningInstances(userId: string): Promise<void> {
  // 1. Fetch user's Google integration
  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, userId),
      eq(integrations.provider, "google"),
    ),
  });

  if (!integration?.accessToken || !integration?.refreshToken) {
    console.warn("[cred-push] No Google credentials to push");
    return;
  }

  let accessToken: string;
  let refreshToken: string;
  try {
    accessToken = decryptToken(integration.accessToken);
    refreshToken = decryptToken(integration.refreshToken);
  } catch (err) {
    console.error("[cred-push] Failed to decrypt tokens:", err);
    return;
  }

  const metadata = integration.metadata as { email?: string } | null;
  const payload: CredentialPayload = {
    email: metadata?.email ?? "",
    accessToken,
    refreshToken,
    tokenExpiry: integration.tokenExpiry
      ? new Date(integration.tokenExpiry).toISOString()
      : new Date(Date.now() + 3600_000).toISOString(),
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  };

  // 2. Find all running instances for this user's agents
  const userAgents = await db.query.agents.findMany({
    where: eq(agents.userId, userId),
    with: { instances: true },
  });

  for (const agent of userAgents) {
    const agentConfig = (agent.config as Record<string, unknown>) ?? {};
    const gatewayToken = agentConfig.gatewayToken as string | undefined;
    if (!gatewayToken) continue;

    for (const instance of agent.instances ?? []) {
      if (instance.status === "running" && instance.serverIp) {
        await pushToVm(instance.serverIp, gatewayToken, payload);
      }
    }
  }
}
