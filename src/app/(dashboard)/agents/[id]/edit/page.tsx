import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { AgentEditForm } from "@/components/dashboard/agent-edit-form";

export default async function EditAgentPage({
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

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/agents/${agent.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title={`Edit ${agent.name}`}
          description="Update your agent configuration"
        />
      </div>

      <Card className="mx-auto max-w-2xl border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardHeader>
          <CardTitle className="text-lg">Agent Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <AgentEditForm
            agentId={agent.id}
            defaultValues={{
              name: agent.name,
              description: agent.description ?? "",
              personality: agent.personality ?? "",
              goal: agent.goal ?? "",
              heartbeatEnabled: agent.heartbeatEnabled ?? false,
              heartbeatCron: agent.heartbeatCron ?? "",
              llmProvider: (agent.config as Record<string, unknown>)?.llmProvider as string ?? "openai",
              llmModel: (agent.config as Record<string, unknown>)?.llmModel as string ?? "gpt-4o-mini",
              llmTemperature: (agent.config as Record<string, unknown>)?.llmTemperature as number ?? 0.7,
              llmCustomEndpoint: (agent.config as Record<string, unknown>)?.llmCustomEndpoint as string ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
