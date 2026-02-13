"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Mail,
  Calendar,
  MessageSquare,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  ChevronRight,
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityLog {
  id: string;
  category: string;
  action: string;
  description: string;
  status: string;
  createdAt: string;
  agentId?: string;
  agentName?: string;
  metadata?: Record<string, unknown>;
}

interface AgentActivityFeedProps {
  agentId?: string;
  limit?: number;
  showHeader?: boolean;
  showViewAll?: boolean;
  compact?: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  agent: <Bot className="h-4 w-4" />,
  communication: <Mail className="h-4 w-4" />,
  calendar: <Calendar className="h-4 w-4" />,
  pipeline: <Activity className="h-4 w-4" />,
  integration: <Settings className="h-4 w-4" />,
  system: <Settings className="h-4 w-4" />,
  billing: <AlertCircle className="h-4 w-4" />,
};

const statusColors: Record<string, string> = {
  success: "text-aura-mint",
  failure: "text-destructive",
  pending: "text-aura-amber",
};

const statusIcons: Record<string, React.ReactNode> = {
  success: <CheckCircle className="h-3.5 w-3.5" />,
  failure: <AlertCircle className="h-3.5 w-3.5" />,
  pending: <Clock className="h-3.5 w-3.5" />,
};

function formatTimeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function AgentActivityFeed({
  agentId,
  limit = 10,
  showHeader = true,
  showViewAll = true,
  compact = false,
}: AgentActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivities() {
      try {
        setLoading(true);
        const url = agentId
          ? `/api/agents/${agentId}/logs?limit=${limit}`
          : `/api/audit-log?limit=${limit}`;
        
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to fetch activities");
        
        const data = await res.json();
        setActivities(data.logs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    fetchActivities();
  }, [agentId, limit]);

  if (loading) {
    return (
      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-aura-accent" />
              Recent Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        {showHeader && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-aura-accent" />
              Recent Activity
            </CardTitle>
          </CardHeader>
        )}
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-aura-accent" />
              Recent Activity
            </CardTitle>
            {showViewAll && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/audit-log" className="text-aura-text-dim hover:text-aura-text">
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="h-10 w-10 text-aura-text-dim/30 mb-3" />
            <p className="text-sm text-aura-text-dim">No activity yet</p>
            <p className="text-xs text-aura-text-dim/70 mt-1">
              Actions will appear here as your agent works
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {activities.map((activity, index) => (
              <div
                key={activity.id}
                className={`group relative flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-aura-panel ${
                  compact ? "py-1.5" : "py-2"
                }`}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {/* Category Icon */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aura-panel text-aura-text-dim">
                  {categoryIcons[activity.category] || <Activity className="h-4 w-4" />}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={`font-medium ${compact ? "text-sm" : "text-sm"}`}>
                      {activity.description}
                    </p>
                    <span className={`flex items-center gap-1 ${statusColors[activity.status]}`}>
                      {statusIcons[activity.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-aura-text-dim">
                    <span>{formatTimeAgo(activity.createdAt)}</span>
                    {activity.agentName && !agentId && (
                      <>
                        <span>•</span>
                        <Link
                          href={`/agents/${activity.agentId}`}
                          className="hover:text-aura-accent"
                        >
                          {activity.agentName}
                        </Link>
                      </>
                    )}
                    <Badge
                      variant="secondary"
                      className="h-5 bg-aura-panel px-1.5 text-[10px] font-normal text-aura-text-dim"
                    >
                      {activity.category}
                    </Badge>
                  </div>
                </div>

                {/* Hover indicator */}
                <div className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-aura-accent opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
