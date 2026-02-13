import { notFound } from "next/navigation";
import Link from "next/link";
import { Edit, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/dashboard/page-header";
import { AgentActions } from "@/components/dashboard/agent-actions";

const statusColors: Record<string, string> = {
  draft: "bg-aura-text-dim/20 text-aura-text-dim",
  active: "bg-aura-mint/20 text-aura-mint",
  paused: "bg-aura-amber/20 text-aura-amber",
  error: "bg-destructive/20 text-destructive",
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, id),
  });

  if (!agent || agent.userId !== user.id) notFound();

  const fields = [
    { label: "Description", value: agent.description || "—" },
    { label: "Personality", value: agent.personality || "—" },
    { label: "Goal", value: agent.goal || "—" },
    {
      label: "Heartbeat",
      value: agent.heartbeatEnabled
        ? `Enabled (${agent.heartbeatCron ?? "No schedule"})`
        : "Disabled",
    },
    {
      label: "Created",
      value: agent.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/agents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader title={agent.name}>
          <Badge variant="secondary" className={statusColors[agent.status]}>
            {agent.status}
          </Badge>
          <Button variant="outline" asChild>
            <Link href={`/agents/${agent.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
          <AgentActions agentId={agent.id} status={agent.status} />
        </PageHeader>
      </div>

      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardHeader>
          <CardTitle className="text-lg">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field) => (
            <div key={field.label}>
              <label className="text-sm font-medium text-aura-text-dim">
                {field.label}
              </label>
              <p className="mt-1 text-sm">{field.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
