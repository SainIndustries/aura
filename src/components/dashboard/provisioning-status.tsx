"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Server,
  Play,
  Square,
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Globe,
  Clock,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProvisioningStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
}

interface Instance {
  id: string;
  agentId: string;
  status: "pending" | "provisioning" | "running" | "stopping" | "stopped" | "failed";
  serverId: string | null;
  serverIp: string | null;
  tailscaleIp: string | null;
  region: string | null;
  error: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProvisioningStatusProps {
  agentId: string;
}

const statusColors: Record<string, string> = {
  pending: "bg-aura-amber/20 text-aura-amber",
  provisioning: "bg-aura-accent/20 text-aura-accent",
  running: "bg-aura-mint/20 text-aura-mint",
  stopping: "bg-aura-amber/20 text-aura-amber",
  stopped: "bg-aura-text-dim/20 text-aura-text-dim",
  failed: "bg-destructive/20 text-destructive",
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function StepIndicator({ step }: { step: ProvisioningStep }) {
  const icons = {
    pending: <Circle className="h-4 w-4 text-aura-text-dim" />,
    active: <Loader2 className="h-4 w-4 text-aura-accent animate-spin" />,
    completed: <CheckCircle2 className="h-4 w-4 text-aura-mint" />,
    error: <AlertCircle className="h-4 w-4 text-destructive" />,
  };

  return (
    <div className="flex items-center gap-2">
      {icons[step.status]}
      <span
        className={
          step.status === "active"
            ? "text-aura-accent font-medium"
            : step.status === "completed"
            ? "text-aura-mint"
            : step.status === "error"
            ? "text-destructive"
            : "text-aura-text-dim"
        }
      >
        {step.label}
      </span>
    </div>
  );
}

export function ProvisioningStatus({ agentId }: ProvisioningStatusProps) {
  const [instance, setInstance] = useState<Instance | null>(null);
  const [steps, setSteps] = useState<ProvisioningStep[] | null>(null);
  const [uptime, setUptime] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/instance`);
      const data = await res.json();

      if (res.ok) {
        setInstance(data.instance);
        setSteps(data.steps);
        setUptime(data.uptime);
        setError(null);
      } else {
        setError(data.error || "Failed to fetch status");
      }
    } catch (err) {
      console.error("Error fetching status:", err);
      setError("Failed to fetch status");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchStatus();

    // Poll for updates while provisioning or stopping
    const interval = setInterval(() => {
      if (
        instance?.status === "pending" ||
        instance?.status === "provisioning" ||
        instance?.status === "stopping"
      ) {
        fetchStatus();
      } else if (instance?.status === "running") {
        // Update uptime
        setUptime((prev) => (prev !== null ? prev + 1 : null));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [fetchStatus, instance?.status]);

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "us-east" }),
      });

      const data = await res.json();

      if (res.ok) {
        setInstance(data.instance);
        setSteps(data.steps);
      } else {
        setError(data.error || "Failed to deploy agent");
      }
    } catch (err) {
      console.error("Error deploying:", err);
      setError("Failed to deploy agent");
    } finally {
      setDeploying(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    setError(null);

    try {
      const res = await fetch(`/api/agents/${agentId}/instance`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (res.ok) {
        setInstance(data.instance);
        setSteps(data.steps);
      } else {
        setError(data.error || "Failed to stop agent");
      }
    } catch (err) {
      console.error("Error stopping:", err);
      setError("Failed to stop agent");
    } finally {
      setStopping(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-aura-accent" />
        </CardContent>
      </Card>
    );
  }

  // No instance yet - show deploy button
  if (!instance || instance.status === "stopped" || instance.status === "failed") {
    return (
      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5" />
            Deployment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {instance?.status === "failed" && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Deployment Failed</span>
              </div>
              <p className="mt-1 text-sm text-destructive/80">
                {instance.error || "An unknown error occurred"}
              </p>
            </div>
          )}

          {instance?.status === "stopped" && (
            <p className="text-sm text-aura-text-dim">
              This agent was previously deployed and has been stopped.
            </p>
          )}

          {!instance && (
            <p className="text-sm text-aura-text-dim">
              Deploy this agent to a dedicated server where it can run 24/7 and
              connect to all configured channels.
            </p>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleDeploy}
            disabled={deploying}
            className="bg-aura-accent hover:bg-aura-accent/90"
          >
            {deploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Deploy Agent
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Instance exists - show status
  return (
    <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="h-5 w-5" />
          Deployment
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={statusColors[instance.status]}>
            {instance.status}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchStatus}
            className="h-8 w-8"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Steps */}
        {(instance.status === "pending" || instance.status === "provisioning") && steps && (
          <div className="space-y-2">
            {steps.map((step) => (
              <StepIndicator key={step.id} step={step} />
            ))}
          </div>
        )}

        {/* Running Instance Details */}
        {instance.status === "running" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-aura-text-dim">
                  Region
                </label>
                <div className="flex items-center gap-1.5 mt-1">
                  <Globe className="h-3.5 w-3.5 text-aura-accent" />
                  <span className="text-sm">{instance.region || "us-east"}</span>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-aura-text-dim">
                  Uptime
                </label>
                <div className="flex items-center gap-1.5 mt-1">
                  <Clock className="h-3.5 w-3.5 text-aura-mint" />
                  <span className="text-sm">
                    {uptime !== null ? formatUptime(uptime) : "—"}
                  </span>
                </div>
              </div>
            </div>

            {instance.serverIp && (
              <div>
                <label className="text-xs font-medium text-aura-text-dim">
                  Server IP
                </label>
                <p className="text-sm font-mono mt-1">{instance.serverIp}</p>
              </div>
            )}

            {instance.tailscaleIp && (
              <div>
                <label className="text-xs font-medium text-aura-text-dim">
                  Tailscale IP
                </label>
                <p className="text-sm font-mono mt-1">{instance.tailscaleIp}</p>
              </div>
            )}
          </div>
        )}

        {/* Stopping state */}
        {instance.status === "stopping" && (
          <div className="flex items-center gap-2 text-aura-amber">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Shutting down instance...</span>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Actions */}
        {instance.status === "running" && (
          <Button
            variant="outline"
            onClick={handleStop}
            disabled={stopping}
            className="text-destructive hover:text-destructive"
          >
            {stopping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <Square className="mr-2 h-4 w-4" />
                Stop Instance
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
