"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle,
  Sparkles,
  Plug,
  MessageSquare,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProvisioningStatus } from "./provisioning-status";

interface AgentDetailClientProps {
  agentId: string;
  hasIntegrations: boolean;
  hasChannels: boolean;
}

function AgentDetailClientInner({
  agentId,
  hasIntegrations,
  hasChannels,
}: AgentDetailClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isSuccess = searchParams.get("success") === "true";
  
  const [showSuccess, setShowSuccess] = useState(isSuccess);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null);
  const [autoDeployTriggered, setAutoDeployTriggered] = useState(false);

  const triggerDeploy = useCallback(async () => {
    if (isDeploying) return;
    
    setIsDeploying(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/provision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ region: "us-east" }),
      });

      const data = await res.json();

      if (res.ok) {
        setDeploymentStatus(data.instance?.status || "pending");
      } else {
        // If already has active instance, that's fine
        if (data.error?.includes("already has an active")) {
          setDeploymentStatus("running");
        }
      }
    } catch (error) {
      console.error("Deploy error:", error);
    } finally {
      setIsDeploying(false);
    }
  }, [agentId, isDeploying]);

  // Auto-deploy after payment success
  useEffect(() => {
    if (isSuccess && !autoDeployTriggered) {
      setAutoDeployTriggered(true);
      // Delay to show success message first
      const timer = setTimeout(() => {
        triggerDeploy();
        // Clear the success param from URL
        router.replace(`/agents/${agentId}`, { scroll: false });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, autoDeployTriggered, triggerDeploy, router, agentId]);

  return (
    <div className="space-y-6">
      {/* Payment Success Banner */}
      {showSuccess && (
        <Card className="border-aura-mint/30 bg-aura-mint/5 animate-fade-in">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-aura-mint/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-aura-mint" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-aura-text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-aura-mint" />
                  Payment successful! Your 7-day trial has started.
                </h3>
                <p className="text-sm text-aura-text-dim mt-1">
                  {isDeploying
                    ? "Starting deployment..."
                    : "Deploying your agent now. This usually takes under 30 seconds."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSuccess(false)}
                className="text-aura-text-dim"
              >
                ×
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Provisioning Status */}
      <ProvisioningStatus agentId={agentId} />

      {/* Connect Tools Prompt - show after deployment or when running */}
      {(deploymentStatus === "running" || !showSuccess) && (!hasIntegrations || !hasChannels) && (
        <Card className="border-aura-accent/20 bg-aura-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Plug className="w-5 h-5 text-aura-accent" />
              Connect Your Tools
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-aura-text-dim mb-4">
              Your agent is ready! Connect your tools so it can start working for you.
            </p>
            <div className="flex flex-wrap gap-3">
              {!hasChannels && (
                <Button asChild className="bg-aura-accent hover:bg-aura-accent-bright">
                  <Link href="/channels">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Add Channel (WhatsApp, Slack, etc.)
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              )}
              {!hasIntegrations && (
                <Button variant="outline" asChild>
                  <Link href="/integrations">
                    <Plug className="mr-2 h-4 w-4" />
                    Connect Integrations
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AgentDetailClient(props: AgentDetailClientProps) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-aura-accent" />
      </div>
    }>
      <AgentDetailClientInner {...props} />
    </Suspense>
  );
}
