"use client";

import Link from "next/link";
import { useState } from "react";
import { Bot, Play, Pause, Edit, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleAgentStatus } from "@/app/(dashboard)/agents/actions";
import { DeleteAgentDialog } from "./delete-agent-dialog";

interface AgentCardProps {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused" | "error";
}

const statusColors: Record<string, string> = {
  draft: "bg-aura-text-dim/20 text-aura-text-dim",
  active: "bg-aura-mint/20 text-aura-mint",
  paused: "bg-aura-amber/20 text-aura-amber",
  error: "bg-destructive/20 text-destructive",
};

export function AgentCard({ id, name, description, status }: AgentCardProps) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <Card className="group border-[rgba(255,255,255,0.05)] bg-aura-surface transition-all hover:border-[rgba(79,143,255,0.12)]">
        <CardHeader className="flex flex-row items-start justify-between">
          <Link href={`/agents/${id}`} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-accent/10">
              <Bot className="h-5 w-5 text-aura-accent" />
            </div>
            <CardTitle className="text-base">{name}</CardTitle>
          </Link>
          <Badge variant="secondary" className={statusColors[status]}>
            {status}
          </Badge>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-aura-text-dim">
            {description || "No description"}
          </p>
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <form action={toggleAgentStatus.bind(null, id)}>
              <Button type="submit" variant="ghost" size="sm" className="h-8 px-2">
                {status === "active" ? (
                  <Pause className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <Play className="mr-1 h-3.5 w-3.5" />
                )}
                {status === "active" ? "Pause" : "Activate"}
              </Button>
            </form>
            <Button variant="ghost" size="sm" className="h-8 px-2" asChild>
              <Link href={`/agents/${id}/edit`}>
                <Edit className="mr-1 h-3.5 w-3.5" />
                Edit
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-destructive hover:text-destructive"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
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
