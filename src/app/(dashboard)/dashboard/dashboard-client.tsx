"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { Bot, Activity, CreditCard, Clock, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { UpgradeBanner } from "@/components/dashboard/upgrade-banner";

interface DashboardClientProps {
  userName: string | null;
  stats: {
    totalAgents: number;
    activeAgents: number;
    subscriptionLabel: string;
    trialDays: string;
  };
}

export function DashboardClient({ userName, stats }: DashboardClientProps) {
  const { user } = usePrivy();
  const name = userName ?? user?.email?.address?.split("@")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const statCards = [
    {
      label: "Total Agents",
      value: String(stats.totalAgents),
      icon: Bot,
      color: "text-aura-accent",
    },
    {
      label: "Active Agents",
      value: String(stats.activeAgents),
      icon: Activity,
      color: "text-aura-mint",
    },
    {
      label: "Subscription",
      value: stats.subscriptionLabel,
      icon: CreditCard,
      color: "text-aura-amber",
    },
    {
      label: "Trial Days",
      value: stats.trialDays,
      icon: Clock,
      color: "text-[#a78bfa]",
    },
  ];

  const showUpgrade = stats.subscriptionLabel === "None";

  return (
    <div className="space-y-8">
      <PageHeader title={`Welcome back, ${name}`} description={today} />

      {showUpgrade && <UpgradeBanner />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card
            key={stat.label}
            className="border-[rgba(255,255,255,0.05)] bg-aura-surface"
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-aura-text-dim">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.totalAgents === 0 && (
        <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bot className="mb-4 h-12 w-12 text-aura-text-ghost" />
            <h3 className="mb-2 text-lg font-semibold">
              Create your first agent
            </h3>
            <p className="mb-6 max-w-sm text-center text-sm text-aura-text-dim">
              Set up an AI agent to handle scheduling, research, communications,
              and more.
            </p>
            <Button asChild>
              <Link href="/agents/new">
                <Plus className="mr-2 h-4 w-4" />
                Create New Agent
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
