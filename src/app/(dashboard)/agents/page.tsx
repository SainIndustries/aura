import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { AgentCard } from "@/components/dashboard/agent-card";

export default async function AgentsPage() {
  const user = await getCurrentUser();
  const userAgents = user
    ? await db.query.agents.findMany({
        where: eq(agents.userId, user.id),
        orderBy: (a, { desc }) => [desc(a.createdAt)],
      })
    : [];

  const tabs = [
    { value: "all", label: "All", agents: userAgents },
    {
      value: "active",
      label: "Active",
      agents: userAgents.filter((a) => a.status === "active"),
    },
    {
      value: "paused",
      label: "Paused",
      agents: userAgents.filter((a) => a.status === "paused"),
    },
    {
      value: "draft",
      label: "Draft",
      agents: userAgents.filter((a) => a.status === "draft"),
    },
  ];

  if (userAgents.length === 0) {
    return (
      <div className="space-y-8">
        <PageHeader title="Agents" description="Manage your AI agents">
          <Button asChild>
            <Link href="/agents/new">
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Link>
          </Button>
        </PageHeader>

        <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="mb-4 h-12 w-12 text-aura-text-ghost" />
            <h3 className="mb-2 text-lg font-semibold">
              Create Your First Agent
            </h3>
            <p className="mb-6 max-w-sm text-center text-sm text-aura-text-dim">
              Get started by creating an AI agent. Configure its personality,
              goals, and schedule.
            </p>
            <Button asChild>
              <Link href="/agents/new">
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Agents" description="Manage your AI agents">
        <Button asChild>
          <Link href="/agents/new">
            <Plus className="mr-2 h-4 w-4" />
            New Agent
          </Link>
        </Button>
      </PageHeader>

      <Tabs defaultValue="all">
        <TabsList>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label} ({tab.agents.length})
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tab.agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  id={agent.id}
                  name={agent.name}
                  description={agent.description}
                  status={agent.status}
                />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
