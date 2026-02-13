import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getUserSubscription(userId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
    orderBy: (s, { desc }) => [desc(s.createdAt)],
  });

  if (!sub) return null;

  const isTrialing =
    sub.status === "trialing" && sub.trialEnd && sub.trialEnd > new Date();
  const trialDaysRemaining = isTrialing
    ? Math.ceil(
        (sub.trialEnd!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  return {
    ...sub,
    isTrialing,
    trialDaysRemaining,
    isActive: sub.status === "active" || isTrialing,
  };
}
