"use client";

import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Rocket, Bot, Brain, Clock } from "lucide-react";
import type { CreateAgentData } from "@/lib/validators/agent";

const LLM_PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  groq: "Groq",
  custom: "Custom",
};

interface StepReviewProps {
  form: UseFormReturn<CreateAgentData>;
  onBack: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export function StepReview({
  form,
  onBack,
  onSubmit,
  isSubmitting,
}: StepReviewProps) {
  const data = form.getValues();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-aura-text-white">
          Review & Create
        </h2>
        <p className="text-sm text-aura-text-dim">
          Review your agent configuration before creating.
        </p>
      </div>

      {/* Agent Basics */}
      <Card className="border-aura-border bg-aura-elevated/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-aura-text-dim flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Agent Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-xs font-medium text-aura-text-ghost uppercase tracking-wider">
              Name
            </label>
            <p className="mt-1 text-aura-text-white font-medium">{data.name}</p>
          </div>
          {data.description && (
            <div>
              <label className="text-xs font-medium text-aura-text-ghost uppercase tracking-wider">
                Description
              </label>
              <p className="mt-1 text-sm text-aura-text-light">{data.description}</p>
            </div>
          )}
          {data.personality && (
            <div>
              <label className="text-xs font-medium text-aura-text-ghost uppercase tracking-wider">
                Personality
              </label>
              <p className="mt-1 text-sm text-aura-text-light">{data.personality}</p>
            </div>
          )}
          {data.goal && (
            <div>
              <label className="text-xs font-medium text-aura-text-ghost uppercase tracking-wider">
                Goal
              </label>
              <p className="mt-1 text-sm text-aura-text-light">{data.goal}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LLM Configuration */}
      <Card className="border-aura-border bg-aura-elevated/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-aura-text-dim flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI Model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-aura-text-ghost uppercase tracking-wider">
                Provider
              </label>
              <p className="mt-1 text-aura-text-white font-medium">
                {LLM_PROVIDER_NAMES[data.llmProvider || "openai"] || data.llmProvider}
              </p>
            </div>
            <div>
              <label className="text-xs font-medium text-aura-text-ghost uppercase tracking-wider">
                Model
              </label>
              <p className="mt-1 text-aura-text-white font-medium">
                {data.llmModel || "gpt-4o-mini"}
              </p>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-aura-text-ghost uppercase tracking-wider">
              Temperature
            </label>
            <p className="mt-1 text-aura-text-white font-medium">
              {(data.llmTemperature ?? 0.7).toFixed(1)}
              <span className="text-aura-text-dim font-normal ml-2">
                ({(data.llmTemperature ?? 0.7) < 0.4 ? "Precise" : (data.llmTemperature ?? 0.7) > 0.7 ? "Creative" : "Balanced"})
              </span>
            </p>
          </div>
          {data.llmProvider === "custom" && data.llmCustomEndpoint && (
            <div>
              <label className="text-xs font-medium text-aura-text-ghost uppercase tracking-wider">
                Custom Endpoint
              </label>
              <p className="mt-1 text-sm text-aura-text-light font-mono truncate">
                {data.llmCustomEndpoint}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Heartbeat */}
      <Card className="border-aura-border bg-aura-elevated/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-aura-text-dim flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Heartbeat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-aura-text-white font-medium">
            {data.heartbeatEnabled ? (
              <>
                <span className="text-aura-mint">Enabled</span>
                {data.heartbeatCron && (
                  <span className="text-aura-text-dim font-normal ml-2">
                    Schedule: <code className="text-aura-accent">{data.heartbeatCron}</code>
                  </span>
                )}
              </>
            ) : (
              <span className="text-aura-text-dim">Disabled</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Pricing Info */}
      <Card className="border-aura-mint/20 bg-aura-mint/5">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-aura-text-white">
                7-day free trial, then $199/month
              </p>
              <p className="text-xs text-aura-text-dim mt-1">
                Cancel anytime. Deploy unlimited agents.
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-aura-text-white">$0</span>
              <span className="text-aura-text-dim text-sm"> today</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button 
          onClick={onSubmit} 
          disabled={isSubmitting}
          className="bg-aura-accent hover:bg-aura-accent-bright"
        >
          {isSubmitting ? (
            <>
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              Continue to Payment
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
