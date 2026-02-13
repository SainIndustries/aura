"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteAgentDialog } from "./delete-agent-dialog";

interface DeleteAgentButtonClientProps {
  agentId: string;
}

export function DeleteAgentButtonClient({ agentId }: DeleteAgentButtonClientProps) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setShowDelete(true)}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Delete Agent
      </Button>

      <DeleteAgentDialog
        agentId={agentId}
        open={showDelete}
        onOpenChange={setShowDelete}
      />
    </>
  );
}
