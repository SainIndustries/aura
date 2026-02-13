"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AgentStatusToggleProps {
  agentId: string;
  status: string;
  size?: "sm" | "default" | "lg";
}

export function AgentStatusToggle({
  agentId,
  status,
  size = "default",
}: AgentStatusToggleProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isActive = status === "active";

  async function handleToggle() {
    setLoading(true);
    try {
      const endpoint = isActive
        ? `/api/agents/${agentId}/stop`
        : `/api/agents/${agentId}/start`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to toggle agent status");
      }

      router.refresh();
    } catch (error) {
      console.error("Failed to toggle agent:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={isActive ? "outline" : "default"}
      size={size}
      onClick={handleToggle}
      disabled={loading}
      className={
        isActive
          ? "border-aura-amber/30 text-aura-amber hover:bg-aura-amber/10 hover:text-aura-amber"
          : "bg-aura-mint text-aura-background hover:bg-aura-mint/90"
      }
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isActive ? (
        <Pause className="mr-2 h-4 w-4" />
      ) : (
        <Play className="mr-2 h-4 w-4" />
      )}
      {loading ? "Processing..." : isActive ? "Stop Agent" : "Start Agent"}
    </Button>
  );
}
