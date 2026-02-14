"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Bot, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createAgent } from "../actions";
import { TEMPLATES } from "@/lib/data/templates";

// Simplified schema - just the essentials
const quickAgentSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  description: z.string().max(500).optional(),
  personality: z.string().max(1000).optional(),
});

type QuickAgentData = z.infer<typeof quickAgentSchema>;

const personalityPresets = [
  { id: "professional", label: "Professional", description: "Formal, precise, business-focused" },
  { id: "friendly", label: "Friendly", description: "Warm, conversational, approachable" },
  { id: "concise", label: "Concise", description: "Brief, to-the-point, efficient" },
];

function NewAgentContent() {
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  const template = templateId ? TEMPLATES.find((t) => t.id === templateId) : null;

  const form = useForm<QuickAgentData>({
    resolver: zodResolver(quickAgentSchema),
    defaultValues: {
      name: "",
      description: "",
      personality: "",
    },
  });

  // Pre-fill from template
  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description,
        personality: template.personality,
      });
    }
  }, [template, form]);

  const handlePresetClick = (presetId: string) => {
    setSelectedPreset(presetId);
    const preset = personalityPresets.find(p => p.id === presetId);
    if (preset) {
      form.setValue("personality", preset.description);
    }
  };

  const handleSubmit = async (data: QuickAgentData) => {
    setIsSubmitting(true);
    try {
      // Create agent with defaults for LLM settings
      await createAgent({
        name: data.name,
        description: data.description || "",
        personality: data.personality || "",
        goal: "",
        heartbeatEnabled: false,
        heartbeatCron: "",
        llmProvider: "openai",
        llmModel: "gpt-4o-mini",
        llmTemperature: 0.7,
        llmCustomEndpoint: "",
      });
    } catch (error) {
      console.error("Failed to create agent:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-aura-accent/10 text-aura-accent flex items-center justify-center mx-auto mb-4">
            <Bot className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-aura-text-white mb-2">
            Create Your AI Agent
          </h1>
          <p className="text-aura-text-dim">
            Give your agent a name and personality. You can customize more later.
          </p>
        </div>

        <Card className="border-aura-border bg-aura-surface">
          <CardContent className="pt-6">
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Alex, Assistant, Sales Bot"
                  {...form.register("name")}
                  className="bg-aura-elevated border-aura-border"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  What should this agent do?
                  <span className="text-aura-text-dim font-normal ml-1">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="e.g., Handle customer support, schedule meetings, manage my inbox..."
                  rows={2}
                  {...form.register("description")}
                  className="bg-aura-elevated border-aura-border resize-none"
                />
              </div>

              {/* Personality Presets */}
              <div className="space-y-3">
                <Label>Personality</Label>
                <div className="grid grid-cols-3 gap-2">
                  {personalityPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetClick(preset.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        selectedPreset === preset.id
                          ? "border-aura-accent bg-aura-accent/10 text-aura-accent"
                          : "border-aura-border bg-aura-elevated hover:border-aura-border-hover text-aura-text-light"
                      }`}
                    >
                      <div className="font-medium text-sm">{preset.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing Banner */}
              <div className="rounded-lg border border-aura-mint/20 bg-aura-mint/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-aura-mint" />
                    <div>
                      <p className="text-sm font-medium text-aura-text-white">
                        7-day free trial
                      </p>
                      <p className="text-xs text-aura-text-dim">
                        Then $199/month · Cancel anytime
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-aura-text-white">$0</span>
                    <span className="text-aura-text-dim text-sm"> today</span>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-aura-accent hover:bg-aura-accent-bright h-12 text-base"
              >
                {isSubmitting ? (
                  <>
                    <div className="h-5 w-5 mr-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  <>
                    Continue to Payment
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-aura-text-dim">
                You&apos;ll be redirected to Stripe to enter payment details.
                <br />
                Your card won&apos;t be charged during the trial.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function NewAgentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-aura-accent border-t-transparent" />
        </div>
      }
    >
      <NewAgentContent />
    </Suspense>
  );
}
