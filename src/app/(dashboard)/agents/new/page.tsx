"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAgentSchema, type CreateAgentData } from "@/lib/validators/agent";
import { StepIndicator } from "@/components/dashboard/agent-wizard/step-indicator";
import { StepBasics } from "@/components/dashboard/agent-wizard/step-basics";
import { StepLLM } from "@/components/dashboard/agent-wizard/step-llm";
import { StepHeartbeat } from "@/components/dashboard/agent-wizard/step-heartbeat";
import { StepReview } from "@/components/dashboard/agent-wizard/step-review";
import { createAgent } from "../actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TEMPLATES } from "@/lib/data/templates";

function NewAgentContent() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");

  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find the template if one was specified
  const template = templateId
    ? TEMPLATES.find((t) => t.id === templateId)
    : null;

  const form = useForm<CreateAgentData>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      personality: "",
      goal: "",
      heartbeatEnabled: false,
      heartbeatCron: "",
      llmProvider: "openrouter",
      llmModel: "anthropic/claude-sonnet-4-5-20250929",
      llmTemperature: 0.7,
      llmCustomEndpoint: "",
    },
  });

  // Pre-fill form with template data when template is found
  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description,
        personality: template.personality,
        goal: template.goal,
        heartbeatEnabled: false,
        heartbeatCron: "",
        llmProvider: "openrouter",
        llmModel: "anthropic/claude-sonnet-4-5-20250929",
        llmTemperature: 0.7,
        llmCustomEndpoint: "",
      });
    }
  }, [template, form]);

  const handleNext = async () => {
    if (step === 0) {
      const valid = await form.trigger(["name", "description", "personality", "goal"]);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const data = form.getValues();
      await createAgent(data);
    } catch (error) {
      console.error("Failed to create agent:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Create New Agent"
        description={
          template
            ? `Starting from the "${template.name}" template`
            : "Set up your AI agent in 4 steps"
        }
      >
        {template && (
          <Badge
            variant="secondary"
            className="bg-aura-accent/10 text-aura-accent"
          >
            <span className="mr-1.5">{template.icon}</span>
            {template.name} Template
          </Badge>
        )}
      </PageHeader>

      <StepIndicator currentStep={step} totalSteps={4} />

      <Card className="mx-auto max-w-2xl border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardContent className="pt-6">
          {step === 0 && <StepBasics form={form} onNext={handleNext} />}
          {step === 1 && (
            <StepLLM form={form} onBack={handleBack} onNext={handleNext} />
          )}
          {step === 2 && (
            <StepHeartbeat form={form} onBack={handleBack} onNext={handleNext} />
          )}
          {step === 3 && (
            <StepReview
              form={form}
              onBack={handleBack}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewAgentPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8">
          <PageHeader
            title="Create New Agent"
            description="Set up your AI agent in 4 steps"
          />
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-aura-accent border-t-transparent" />
          </div>
        </div>
      }
    >
      <NewAgentContent />
    </Suspense>
  );
}
