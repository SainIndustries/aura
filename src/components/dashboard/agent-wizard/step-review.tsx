"use client";

import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { CreateAgentData } from "@/lib/validators/agent";

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

  const fields = [
    { label: "Name", value: data.name },
    { label: "Description", value: data.description || "—" },
    { label: "Personality", value: data.personality || "—" },
    { label: "Goal", value: data.goal || "—" },
    {
      label: "Heartbeat",
      value: data.heartbeatEnabled
        ? `Enabled (${data.heartbeatCron ?? "No schedule"})`
        : "Disabled",
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardContent className="space-y-4 pt-6">
          {fields.map((field) => (
            <div key={field.label}>
              <label className="text-sm font-medium text-aura-text-dim">
                {field.label}
              </label>
              <p className="mt-1 text-sm">{field.value}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create Agent"}
        </Button>
      </div>
    </div>
  );
}
