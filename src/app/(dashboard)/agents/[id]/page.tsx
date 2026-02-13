import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Edit,
  ArrowLeft,
  Play,
  Pause,
  Trash2,
  FileText,
  Clock,
  Target,
  Brain,
  Zap,
  MessageSquare,
  Settings,
  Activity,
} from "lucide-react";
import { db } from "@/lib/db";
import { agents, integrations, channels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/dashboard/page-header";
import { AgentStatusToggle } from "@/components/dashboard/agent-status-toggle";
import { AgentActivityFeed } from "@/components/dashboard/agent-activity-feed";
import { DeleteAgentDialog } from "@/components/dashboard/delete-agent-dialog";
import { getAgentStats } from "@/lib/dashboard-stats";

const statusColors: Record<string, string> = {
  draft: "bg-aura-text-dim/20 text-aura-text-dim",
  active: "bg-aura-mint/20 text-aura-mint",
  paused: "bg-aura-amber/20 text-aura-amber",
  error: "bg-destructive/20 text-destructive",
};

const statusDescriptions: Record<string, string> = {
  draft: "This agent is in draft mode and hasn't been activated yet.",
  active: "This agent is running and processing tasks.",
  paused: "This agent is paused and not processing any tasks.",
  error: "This agent encountered an error and needs attention.",
};

const channelIcons: Record<string, string> = {
  web: "🌐",
  slack: "💬",
  telegram: "✈️",
  whatsapp: "📱",
  discord: "🎮",
  email: "📧",
};

const integrationIcons: Record<string, string> = {
  google: "🔗",
  slack: "💬",
  github: "🐙",
  notion: "📝",
  linear: "📊",
  gmail: "📧",
  calendar: "📅",
};

function formatTimeAgo(date: Date | null): string {
  if (!date) return "Never";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

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

  // Get agent stats
  const stats = await getAgentStats(user.id, id);

  // Get user integrations
  const userIntegrations = await db.query.integrations.findMany({
    where: eq(integrations.userId, user.id),
  });

  // Get agent channels
  const agentChannels = await db.query.channels.findMany({
    where: and(eq(channels.userId, user.id), eq(channels.agentId, id)),
  });

  return (
    <div className="space-y-8">
      {/* Header */}
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
        </PageHeader>
      </div>

      {/* Status Card */}
      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Zap className="h-5 w-5 text-aura-accent" />
              Agent Status
            </CardTitle>
            <Badge
              variant="secondary"
              className={`${statusColors[agent.status]} px-3 py-1 text-sm`}
            >
              {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-aura-text-dim">
                {statusDescriptions[agent.status]}
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-aura-text-dim">
                  <Activity className="h-4 w-4" />
                  {stats.totalActions} actions
                </span>
                <span className="flex items-center gap-1 text-aura-text-dim">
                  <Clock className="h-4 w-4" />
                  Last active: {formatTimeAgo(stats.lastAgentActivity)}
                </span>
              </div>
            </div>
            <AgentStatusToggle agentId={agent.id} status={agent.status} />
          </div>
        </CardContent>
      </Card>

      {/* Deployment Status */}
      <ProvisioningStatus agentId={agent.id} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Configuration Summary */}
        <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Settings className="h-5 w-5 text-aura-accent" />
              Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-aura-text-dim">
                <FileText className="h-4 w-4" />
                Description
              </div>
              <p className="mt-1 text-sm">{agent.description || "No description set"}</p>
            </div>

            <Separator className="bg-aura-panel" />

            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-aura-text-dim">
                <Brain className="h-4 w-4" />
                Personality
              </div>
              <p className="mt-1 text-sm">{agent.personality || "Default personality"}</p>
            </div>

            <Separator className="bg-aura-panel" />

            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-aura-text-dim">
                <Target className="h-4 w-4" />
                Goal
              </div>
              <p className="mt-1 text-sm">{agent.goal || "No specific goal set"}</p>
            </div>

            <Separator className="bg-aura-panel" />

            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-aura-text-dim">
                <Clock className="h-4 w-4" />
                Heartbeat Schedule
              </div>
              <p className="mt-1 text-sm">
                {agent.heartbeatEnabled
                  ? `Enabled — ${agent.heartbeatCron || "Default schedule"}`
                  : "Disabled"}
              </p>
            </div>

            <Separator className="bg-aura-panel" />

            <div className="flex items-center gap-4 pt-2 text-xs text-aura-text-dim">
              <span>
                Created:{" "}
                {agent.createdAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span>
                Updated:{" "}
                {agent.updatedAt.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Channels & Integrations */}
        <div className="space-y-6">
          {/* Channels */}
          <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="h-5 w-5 text-aura-accent" />
                  Channels
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/channels">Manage</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {agentChannels.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <MessageSquare className="h-8 w-8 text-aura-text-dim/30 mb-2" />
                  <p className="text-sm text-aura-text-dim">No channels connected</p>
                  <Button variant="link" size="sm" asChild className="mt-1">
                    <Link href="/channels">Connect a channel</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {agentChannels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center justify-between rounded-lg bg-aura-panel p-3"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{channelIcons[channel.type] || "📡"}</span>
                        <div>
                          <p className="text-sm font-medium">{channel.name}</p>
                          <p className="text-xs text-aura-text-dim capitalize">{channel.type}</p>
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={
                          channel.enabled
                            ? "bg-aura-mint/20 text-aura-mint"
                            : "bg-aura-text-dim/20 text-aura-text-dim"
                        }
                      >
                        {channel.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Integrations */}
          <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="h-5 w-5 text-aura-accent" />
                  Connected Integrations
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/integrations">Manage</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {userIntegrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <Zap className="h-8 w-8 text-aura-text-dim/30 mb-2" />
                  <p className="text-sm text-aura-text-dim">No integrations connected</p>
                  <Button variant="link" size="sm" asChild className="mt-1">
                    <Link href="/integrations">Connect an integration</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {userIntegrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center gap-2 rounded-lg bg-aura-panel px-3 py-2"
                    >
                      <span className="text-lg">
                        {integrationIcons[integration.provider] || "🔗"}
                      </span>
                      <span className="text-sm capitalize">{integration.provider}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity Feed */}
      <AgentActivityFeed agentId={agent.id} limit={10} showViewAll={true} />

      {/* Quick Actions */}
      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link href={`/agents/${agent.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Configuration
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/audit-log?agentId=${agent.id}`}>
                <FileText className="mr-2 h-4 w-4" />
                View Full Logs
              </Link>
            </Button>
            <DeleteAgentButton agentId={agent.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Client component for delete button with dialog
function DeleteAgentButton({ agentId }: { agentId: string }) {
  return (
    <form>
      <DeleteAgentButtonClient agentId={agentId} />
    </form>
  );
}

import { DeleteAgentButtonClient } from "@/components/dashboard/delete-agent-button-client";
import { ProvisioningStatus } from "@/components/dashboard/provisioning-status";
