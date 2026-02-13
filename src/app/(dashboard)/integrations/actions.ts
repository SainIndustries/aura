"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

// Providers that support OAuth
const OAUTH_PROVIDERS = ["google", "slack", "github"];

export async function getUserIntegrations() {
  const user = await getCurrentUser();
  if (!user) return [];

  const userIntegrations = await db.query.integrations.findMany({
    where: eq(integrations.userId, user.id),
  });

  return userIntegrations;
}

export async function connectIntegration(provider: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  // Check if already connected
  const existing = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, user.id),
      eq(integrations.provider, provider)
    ),
  });

  if (existing) {
    throw new Error("Integration already connected");
  }

  // For OAuth providers, redirect to the OAuth flow
  if (OAUTH_PROVIDERS.includes(provider)) {
    redirect(`/api/integrations/${provider}`);
  }

  // For non-OAuth providers, create a placeholder integration
  // This will be replaced when we implement those providers
  await db.insert(integrations).values({
    userId: user.id,
    provider,
    accessToken: null,
    refreshToken: null,
    tokenExpiry: null,
    scopes: [],
    metadata: {},
    connectedAt: new Date(),
  });

  revalidatePath("/integrations");
  return { success: true };
}

export async function getOAuthUrl(provider: string): Promise<string | null> {
  if (OAUTH_PROVIDERS.includes(provider)) {
    return `/api/integrations/${provider}`;
  }
  return null;
}

export async function disconnectIntegration(provider: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, user.id),
      eq(integrations.provider, provider)
    ),
  });

  if (!integration) {
    throw new Error("Integration not found");
  }

  await db.delete(integrations).where(eq(integrations.id, integration.id));

  revalidatePath("/integrations");
  return { success: true };
}

export async function getIntegrationStatus(provider: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const integration = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.userId, user.id),
      eq(integrations.provider, provider)
    ),
  });

  return integration;
}

export async function reconnectIntegration(provider: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");

  // For OAuth providers, redirect to the OAuth flow to refresh tokens
  if (OAUTH_PROVIDERS.includes(provider)) {
    redirect(`/api/integrations/${provider}`);
  }

  throw new Error("Provider does not support reconnection");
}

export async function isOAuthProvider(provider: string): Promise<boolean> {
  return OAUTH_PROVIDERS.includes(provider);
}
