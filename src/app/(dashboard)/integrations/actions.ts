"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";

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

  // In a real implementation, this would initiate OAuth flow
  // For now, we'll create a placeholder integration
  await db.insert(integrations).values({
    userId: user.id,
    provider,
    // These would be set after OAuth callback
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
