import { getCurrentUser } from "@/lib/auth/current-user";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const stats = user
    ? await getDashboardStats(user.id)
    : { totalAgents: 0, activeAgents: 0, subscriptionLabel: "None", trialDays: "—" };

  return (
    <DashboardClient
      userName={user?.name ?? user?.email?.split("@")[0] ?? null}
      stats={stats}
    />
  );
}
