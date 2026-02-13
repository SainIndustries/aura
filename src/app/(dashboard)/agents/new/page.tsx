"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAgentSchema, type CreateAgentData } from "@/lib/validators/agent";
import { StepIndicator } from "@/components/dashboard/agent-wizard/step-indicator";
import { StepBasics } from "@/components/dashboard/agent-wizard/step-basics";
import { StepHeartbeat } from "@/components/dashboard/agent-wizard/step-heartbeat";
import { StepReview } from "@/components/dashboard/agent-wizard/step-review";
import { createAgent } from "../actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function NewAgentPage() {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreateAgentData>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      personality: "",
      goal: "",
      heartbeatEnabled: false,
      heartbeatCron: "",
    },
  });

  const handleNext = async () => {
    if (step === 0) {
      const valid = await form.trigger(["name", "description", "personality", "goal"]);
      if (!valid) return;
    }
    setStep((s) => Math.min(s + 1, 2));
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
        description="Set up your AI agent in 3 steps"
      />

      <StepIndicator currentStep={step} />

      <Card className="mx-auto max-w-2xl border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardContent className="pt-6">
          {step === 0 && <StepBasics form={form} onNext={handleNext} />}
          {step === 1 && (
            <StepHeartbeat form={form} onBack={handleBack} onNext={handleNext} />
          )}
          {step === 2 && (
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
