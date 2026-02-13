import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getUserSubscription } from "@/lib/subscription";

export async function getDashboardStats(userId: string) {
  const userAgents = await db.query.agents.findMany({
    where: eq(agents.userId, userId),
  });

  const totalAgents = userAgents.length;
  const activeAgents = userAgents.filter((a) => a.status === "active").length;

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

  return { totalAgents, activeAgents, subscriptionLabel, trialDays };
}
