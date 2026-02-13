"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Play,
  Pause,
  Edit,
  Trash2,
  MoreVertical,
  Activity,
  Clock,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteAgentDialog } from "./delete-agent-dialog";

interface AgentCardProps {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "error";
  lastActivity?: Date | null;
  integrations?: string[];
  actionCount?: number;
}

const statusColors: Record<string, string> = {
  draft: "bg-aura-text-dim/20 text-aura-text-dim",
  active: "bg-aura-mint/20 text-aura-mint",
  paused: "bg-aura-amber/20 text-aura-amber",
  error: "bg-destructive/20 text-destructive",
};

const integrationIcons: Record<string, string> = {
  google: "🔗",
  slack: "💬",
  github: "🐙",
  notion: "📝",
  linear: "📊",
  gmail: "📧",
  calendar: "📅",
  discord: "🎮",
};

function formatTimeAgo(date: Date | null | undefined): string {
  if (!date) return "Never";
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function AgentCard({
  id,
  name,
  description,
  status,
  lastActivity,
  integrations = [],
  actionCount = 0,
}: AgentCardProps) {
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isActive = status === "active";

  async function handleToggleStatus() {
    setLoading(true);
    try {
      const endpoint = isActive
        ? `/api/agents/${id}/stop`
        : `/api/agents/${id}/start`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error("Failed to toggle status");
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to toggle agent:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="group border-[rgba(255,255,255,0.05)] bg-aura-surface transition-all hover:border-[rgba(79,143,255,0.12)]">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <Link href={`/agents/${id}`} className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-accent/10">
              <Bot className="h-5 w-5 text-aura-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base truncate">{name}</CardTitle>
              {lastActivity && (
                <p className="text-xs text-aura-text-dim flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(lastActivity)}
                </p>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={statusColors[status]}>
              {status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={handleToggleStatus}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isActive ? (
                    <Pause className="mr-2 h-4 w-4" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  {isActive ? "Stop Agent" : "Start Agent"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/agents/${id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/audit-log?agentId=${id}`}>
                    <Activity className="mr-2 h-4 w-4" />
                    View Logs
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDelete(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-aura-text-dim line-clamp-2">
            {description || "No description"}
          </p>

          {/* Stats Row */}
          <div className="flex items-center gap-4 text-xs text-aura-text-dim mb-3">
            {actionCount > 0 && (
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {actionCount} actions
              </span>
            )}
          </div>

          {/* Integration Icons */}
          {integrations.length > 0 && (
            <div className="flex items-center gap-1.5 pt-2 border-t border-aura-panel">
              <span className="text-xs text-aura-text-dim mr-1">Connected:</span>
              <div className="flex items-center gap-1">
                {integrations.slice(0, 5).map((integration, idx) => (
                  <span
                    key={idx}
                    className="inline-flex h-6 w-6 items-center justify-center rounded bg-aura-panel text-sm"
                    title={integration}
                  >
                    {integrationIcons[integration.toLowerCase()] || "🔗"}
                  </span>
                ))}
                {integrations.length > 5 && (
                  <span className="text-xs text-aura-text-dim">
                    +{integrations.length - 5}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions on Hover */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-aura-panel opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleToggleStatus}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : isActive ? (
                <Pause className="mr-1 h-3 w-3" />
              ) : (
                <Play className="mr-1 h-3 w-3" />
              )}
              {isActive ? "Stop" : "Start"}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" asChild>
              <Link href={`/agents/${id}/edit`}>
                <Edit className="mr-1 h-3 w-3" />
                Edit
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <DeleteAgentDialog
        agentId={id}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </>
  );
}
