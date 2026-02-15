"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Mascot } from "./mascot";

interface ProvisioningStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
}

type DeployState = "deploying" | "running" | "failed";

const DEPLOY_QUOTES = [
  "Teaching your agent to think before it speaks...",
  "Downloading common sense... this might take a while.",
  "Calibrating sarcasm levels to 'just right'.",
  "Convincing the server hamsters to run faster.",
  "Your agent is doing push-ups. Almost ready.",
  "Brewing digital espresso for your new agent...",
  "Whispering sweet nothings to the cloud servers.",
  "Loading personality... don't worry, it's a good one.",
  "Your agent is stretching. First day jitters.",
  "Spinning up neurons... artificial ones, but still.",
  "Almost there. Your agent is picking out its outfit.",
  "Running final vibe check...",
  "Your agent just asked 'what is my purpose?' Deep.",
  "Installing opinions... this could be dangerous.",
  "Warming up the synapses. Cold boot, warm heart.",
];

function useRotatingQuote() {
  const [index, setIndex] = useState(
    () => Math.floor(Math.random() * DEPLOY_QUOTES.length)
  );
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % DEPLOY_QUOTES.length);
        setVisible(true);
      }, 300);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return { quote: DEPLOY_QUOTES[index], visible };
}

export function StepDeploying({ agentId }: { agentId: string }) {
  const [state, setState] = useState<DeployState>("deploying");
  const [steps, setSteps] = useState<ProvisioningStep[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deployTriggered, setDeployTriggered] = useState(false);
  const { quote, visible } = useRotatingQuote();

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}/instance`);
      const data = await res.json();
      if (res.ok && data.instance) {
        setSteps(data.steps);
        if (data.instance.status === "running") {
          setState("running");
        } else if (data.instance.status === "failed") {
          setState("failed");
          setError(data.instance.error || "Deployment failed");
        }
      }
    } catch {
      // silently retry
    }
  }, [agentId]);

  // Trigger deploy once
  useEffect(() => {
    if (deployTriggered) return;
    setDeployTriggered(true);

    (async () => {
      try {
        const res = await fetch(`/api/agents/${agentId}/provision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ region: "us-east" }),
        });
        const data = await res.json();
        if (res.ok) {
          setSteps(data.steps);
        } else if (data.error?.includes("already has an active")) {
          // Instance exists — check its actual status
          await fetchStatus();
        } else {
          setState("failed");
          setError(data.error || "Failed to start deployment");
        }
      } catch {
        setState("failed");
        setError("Network error");
      }
    })();
  }, [agentId, deployTriggered, fetchStatus]);

  // Poll while deploying
  useEffect(() => {
    if (state !== "deploying") return;
    const interval = setInterval(fetchStatus, 1000);
    return () => clearInterval(interval);
  }, [state, fetchStatus]);

  const completedCount = steps?.filter((s) => s.status === "completed").length ?? 0;
  const totalSteps = steps?.length ?? 5;
  const progress = Math.max(5, (completedCount / totalSteps) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-aura-void flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Mascot with pulse ring */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            {state === "deploying" && (
              <>
                <div className="absolute inset-0 -m-3 rounded-full bg-aura-accent/10 animate-ping" style={{ animationDuration: "2s" }} />
                <div className="absolute inset-0 -m-1.5 rounded-full bg-aura-accent/5 animate-pulse" />
              </>
            )}
            <Mascot size={96} className="relative animate-float" />
          </div>
        </div>

        {state === "deploying" && (
          <div className="space-y-6 animate-fade-slide-up">
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-semibold text-aura-text-white">
                Setting up your agent...
              </h2>
              {/* Rotating quote */}
              <p
                className={`text-sm text-aura-text-dim italic transition-opacity duration-300 h-5 ${
                  visible ? "opacity-100" : "opacity-0"
                }`}
              >
                {quote}
              </p>
            </div>

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="h-2 bg-aura-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-aura-accent to-aura-mint transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Steps */}
            {steps && (
              <div className="space-y-2.5">
                {steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-2.5 text-sm"
                  >
                    {step.status === "completed" ? (
                      <CheckCircle2 className="h-4 w-4 text-aura-mint flex-shrink-0" />
                    ) : step.status === "active" ? (
                      <Loader2 className="h-4 w-4 text-aura-accent animate-spin flex-shrink-0" />
                    ) : step.status === "error" ? (
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-aura-text-ghost flex-shrink-0" />
                    )}
                    <span
                      className={
                        step.status === "completed"
                          ? "text-aura-mint"
                          : step.status === "active"
                            ? "text-aura-accent font-medium"
                            : step.status === "error"
                              ? "text-destructive"
                              : "text-aura-text-ghost"
                      }
                    >
                      {step.label}
                    </span>
                    {step.status === "active" && (
                      <span className="text-xs text-aura-text-ghost ml-auto">
                        in progress
                      </span>
                    )}
                    {step.status === "completed" && (
                      <span className="text-xs text-aura-mint/60 ml-auto">
                        done
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state === "running" && (
          <div className="space-y-6 animate-fade-slide-up">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-aura-text-white">
                Your agent is live!
              </h2>
              <p className="text-sm text-aura-text-dim">
                Everything&apos;s set up and ready to go.
              </p>
            </div>
            <Link
              href="/chat"
              className="flex items-center justify-center gap-2 rounded-full bg-white text-aura-void px-6 py-3 text-sm font-medium hover:bg-white/90 transition-all mx-auto w-fit"
            >
              <MessageSquare className="w-4 h-4" />
              Start Chatting
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {state === "failed" && (
          <div className="space-y-6 animate-fade-slide-up">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-aura-text-white">
                Something went wrong
              </h2>
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setState("deploying");
                  setDeployTriggered(false);
                  setError(null);
                }}
                className="rounded-full bg-white text-aura-void px-6 py-2.5 text-sm font-medium hover:bg-white/90 transition-all"
              >
                Retry
              </button>
              <Link
                href="/agents"
                className="rounded-full border border-aura-border px-6 py-2.5 text-sm font-medium text-aura-text-light hover:text-aura-text-white transition-colors"
              >
                Go to Agents
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
