/**
 * Integration notification pipeline.
 *
 * After a user connects an integration (e.g. Google), the agent needs to
 * acknowledge the new capability on the next chat message.  This module
 * tracks which integrations have been announced to the agent and builds
 * a one-time system-prompt section for un-notified integrations.
 *
 * Tracking uses the existing `integrations.metadata` JSONB column — no
 * schema migration required.
 */

import { db } from "@/lib/db";
import { integrations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingNotification {
  integrationId: string;
  provider: string;
}

// ---------------------------------------------------------------------------
// Provider capability map (agent-facing, concise)
// ---------------------------------------------------------------------------

const providerCapabilities: Record<string, { label: string; abilities: string }> = {
  google: {
    label: "Google Workspace",
    abilities: "read/send emails via Gmail and view/create Google Calendar events",
  },
  slack: {
    label: "Slack",
    abilities: "send and read messages in Slack channels",
  },
  hubspot: {
    label: "HubSpot",
    abilities: "manage contacts, deals, and tasks in HubSpot CRM",
  },
  salesforce: {
    label: "Salesforce",
    abilities: "manage leads, opportunities, and accounts in Salesforce",
  },
  "microsoft-365": {
    label: "Microsoft 365",
    abilities: "read/send Outlook emails and manage calendar events",
  },
  twilio: {
    label: "Twilio",
    abilities: "send SMS messages and manage phone calls",
  },
};

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Return integrations the agent hasn't been told about yet.
 * An integration is "pending" when it has credentials (accessToken set)
 * but `metadata.agentNotifiedAt` is absent.
 */
export async function getPendingNotifications(
  userId: string,
): Promise<PendingNotification[]> {
  const rows = await db.query.integrations.findMany({
    where: eq(integrations.userId, userId),
  });

  const pending: PendingNotification[] = [];
  for (const row of rows) {
    if (!row.accessToken) continue; // not actually connected
    const meta = (row.metadata as Record<string, unknown>) ?? {};
    if (!meta.agentNotifiedAt) {
      pending.push({ integrationId: row.id, provider: row.provider });
    }
  }
  return pending;
}

/**
 * Mark an integration as notified so the announcement doesn't repeat.
 */
export async function markNotified(integrationId: string): Promise<void> {
  const row = await db.query.integrations.findFirst({
    where: eq(integrations.id, integrationId),
  });
  if (!row) return;

  const meta = (row.metadata as Record<string, unknown>) ?? {};
  await db
    .update(integrations)
    .set({
      metadata: { ...meta, agentNotifiedAt: new Date().toISOString() },
    })
    .where(eq(integrations.id, integrationId));
}

// ---------------------------------------------------------------------------
// System-prompt builder
// ---------------------------------------------------------------------------

/**
 * Build a system-prompt section that tells the agent about newly connected
 * integrations.  Returns an empty string when there's nothing to announce.
 */
export function buildNotificationPromptSection(
  providers: string[],
): string {
  if (providers.length === 0) return "";

  const lines = providers.map((p) => {
    const info = providerCapabilities[p];
    const label = info?.label ?? p;
    const abilities = info?.abilities ?? "use its features";
    return `- **${label}** is now connected. You can ${abilities}.`;
  });

  return [
    "",
    "## JUST CONNECTED",
    "The following integration(s) were just connected by the user:",
    ...lines,
    "",
    "At the START of your next response, briefly acknowledge the new connection (e.g. \"Great, I can now access your Gmail and Calendar!\"). Keep it to 1-2 sentences, then address the user's message normally. Don't list all capabilities — the user already saw a summary.",
  ].join("\n");
}
