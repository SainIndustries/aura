import { db } from "@/lib/db";
import { agents, auditLogs, integrations, channels } from "@/lib/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { getUserSubscription } from "@/lib/subscription";

export async function getDashboardStats(userId: string) {
  const userAgents = await db.query.agents.findMany({
    where: eq(agents.userId, userId),
  });

  const totalAgents = userAgents.length;
  const activeAgents = userAgents.filter((a) => a.status === "active").length;

  // Get total actions from audit log
  const actionsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId));
  const totalActions = Number(actionsResult[0]?.count || 0);

  // Get last agent activity
  const lastActivity = await db
    .select({ createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  const lastAgentActivity = lastActivity[0]?.createdAt || null;

  // Get integration count
  const integrationsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(integrations)
    .where(eq(integrations.userId, userId));
  const integrationCount = Number(integrationsResult[0]?.count || 0);

  // Get channel count
  const channelsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(channels)
    .where(eq(channels.userId, userId));
  const channelCount = Number(channelsResult[0]?.count || 0);

  const subscription = await getUserSubscription(userId);

  let subscriptionLabel = "None";
  let trialDays = "—";

  if (subscription) {
    if (subscription.isTrialing) {
      subscriptionLabel = "Trialing";
      trialDays = `${subscription.trialDaysRemaining}d`;
    } else if (subscription.status === "active") {
      subscriptionLabel = "Active";
    } else if (subscription.status === "past_due") {
      subscriptionLabel = "Past Due";
    } else if (subscription.status === "canceled") {
      subscriptionLabel = "Canceled";
    } else {
      subscriptionLabel = subscription.status;
    }
  }

  return {
    totalAgents,
    activeAgents,
    totalActions,
    lastAgentActivity,
    integrationCount,
    channelCount,
    subscriptionLabel,
    trialDays,
  };
}

export async function getAgentStats(userId: string, agentId: string) {
  // Get action count for this specific agent
  const actionsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(and(eq(auditLogs.userId, userId), eq(auditLogs.agentId, agentId)));
  const totalActions = Number(actionsResult[0]?.count || 0);

  // Get last activity for this agent
  const lastActivity = await db
    .select({ createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(and(eq(auditLogs.userId, userId), eq(auditLogs.agentId, agentId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(1);
  const lastAgentActivity = lastActivity[0]?.createdAt || null;

  // Get channels connected to this agent
  const agentChannels = await db.query.channels.findMany({
    where: and(eq(channels.userId, userId), eq(channels.agentId, agentId)),
  });

  return {
    totalActions,
    lastAgentActivity,
    channels: agentChannels,
  };
}
