"use client";

import { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { CreateAgentData } from "@/lib/validators/agent";

interface StepBasicsProps {
  form: UseFormReturn<CreateAgentData>;
  onNext: () => void;
}

export function StepBasics({ form, onNext }: StepBasicsProps) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Agent Name *</Label>
        <Input
          id="name"
          placeholder="e.g., Sales Assistant, Research Bot"
          {...register("name")}
          className="bg-aura-surface"
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="What does this agent do?"
          rows={3}
          {...register("description")}
          className="bg-aura-surface"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="personality">Personality</Label>
        <Textarea
          id="personality"
          placeholder="How should this agent communicate? e.g., Professional, concise, proactive..."
          rows={3}
          {...register("personality")}
          className="bg-aura-surface"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="goal">Goal</Label>
        <Textarea
          id="goal"
          placeholder="What is this agent trying to achieve?"
          rows={3}
          {...register("goal")}
          className="bg-aura-surface"
        />
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}
