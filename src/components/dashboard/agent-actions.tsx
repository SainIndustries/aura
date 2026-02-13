"use client";

import { Play, Pause, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleAgentStatus, deleteAgent } from "@/app/(dashboard)/agents/actions";
import { DeleteAgentDialog } from "./delete-agent-dialog";
import { useState } from "react";

interface AgentActionsProps {
  agentId: string;
  status: string;
}

export function AgentActions({ agentId, status }: AgentActionsProps) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      {(status === "active" || status === "paused" || status === "draft") && (
        <form action={toggleAgentStatus.bind(null, agentId)}>
          <Button type="submit" variant="outline" size="sm">
            {status === "active" ? (
              <>
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Activate
              </>
            )}
          </Button>
        </form>
      )}

      <Button
        variant="outline"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setShowDelete(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>

      <DeleteAgentDialog
        agentId={agentId}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </>
  );
}
