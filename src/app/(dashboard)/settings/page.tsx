import { getCurrentUser } from "@/lib/auth/current-user";
import { getUserSubscription } from "@/lib/subscription";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const subscription = user ? await getUserSubscription(user.id) : null;

  return (
    <SettingsClient
      email={user?.email ?? null}
      userId={user?.privyUserId ?? null}
      subscription={
        subscription
          ? {
              status: subscription.status,
              isTrialing: subscription.isTrialing ?? false,
              trialDaysRemaining: subscription.trialDaysRemaining,
              isActive: subscription.isActive ?? false,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
              currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
