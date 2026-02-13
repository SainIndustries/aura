"use client";

import { UseFormReturn } from "react-hook-form";
import { CreateAgentData } from "@/lib/validators/agent";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, ArrowRight, Brain, Sparkles, Zap, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const LLM_PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Most capable, best for complex tasks" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast and affordable" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "Powerful with larger context" },
    ],
    icon: "🤖",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Excellent for most tasks" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Most capable Claude model" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fast and efficient" },
    ],
    icon: "🧠",
  },
  {
    id: "google",
    name: "Google",
    models: [
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", description: "Advanced reasoning" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", description: "Fast responses" },
    ],
    icon: "✨",
  },
  {
    id: "groq",
    name: "Groq",
    models: [
      { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", description: "Open source, very fast" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", description: "Great balance of speed and quality" },
    ],
    icon: "⚡",
  },
  {
    id: "custom",
    name: "Custom / Self-Hosted",
    models: [],
    icon: "🔧",
  },
];

interface StepLLMProps {
  form: UseFormReturn<CreateAgentData>;
  onBack: () => void;
  onNext: () => void;
}

export function StepLLM({ form, onBack, onNext }: StepLLMProps) {
  const provider = form.watch("llmProvider") || "openai";
  const model = form.watch("llmModel") || "";
  const temperature = form.watch("llmTemperature") ?? 0.7;

  const selectedProvider = LLM_PROVIDERS.find((p) => p.id === provider);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-aura-text-white">
          Configure AI Model
        </h2>
        <p className="text-sm text-aura-text-dim">
          Choose the LLM provider and model that will power your agent.
        </p>
      </div>

      {/* Provider Selection */}
      <div className="space-y-3">
        <Label>LLM Provider</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {LLM_PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                form.setValue("llmProvider", p.id);
                if (p.models.length > 0) {
                  form.setValue("llmModel", p.models[0].id);
                } else {
                  form.setValue("llmModel", "");
                }
              }}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                provider === p.id
                  ? "border-aura-accent bg-aura-accent/10"
                  : "border-aura-border hover:border-aura-border-hover bg-aura-elevated/50"
              )}
            >
              <span className="text-2xl">{p.icon}</span>
              <span className="text-sm font-medium text-aura-text-light">
                {p.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Model Selection */}
      {selectedProvider && selectedProvider.models.length > 0 && (
        <div className="space-y-3">
          <Label>Model</Label>
          <Select
            value={model}
            onValueChange={(value) => form.setValue("llmModel", value)}
          >
            <SelectTrigger className="bg-aura-elevated border-aura-border">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent className="bg-aura-surface border-aura-border">
              {selectedProvider.models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex flex-col">
                    <span>{m.name}</span>
                    <span className="text-xs text-aura-text-dim">
                      {m.description}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Custom Endpoint */}
      {provider === "custom" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customEndpoint">API Endpoint URL</Label>
            <Input
              id="customEndpoint"
              placeholder="https://your-llm-api.com/v1/chat/completions"
              className="bg-aura-elevated border-aura-border"
              {...form.register("llmCustomEndpoint")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customModel">Model Name</Label>
            <Input
              id="customModel"
              placeholder="your-model-name"
              className="bg-aura-elevated border-aura-border"
              {...form.register("llmModel")}
            />
          </div>
        </div>
      )}

      {/* Temperature */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Temperature: {temperature.toFixed(1)}</Label>
          <div className="flex items-center gap-4 text-xs text-aura-text-dim">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3" /> Precise
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Creative
            </span>
          </div>
        </div>
        <Slider
          value={[temperature]}
          onValueChange={([value]) => form.setValue("llmTemperature", value)}
          min={0}
          max={1}
          step={0.1}
          className="w-full"
        />
        <p className="text-xs text-aura-text-ghost">
          Lower values produce more focused outputs. Higher values increase creativity.
        </p>
      </div>

      {/* API Key Info */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-aura-accent/5 border border-aura-accent/20">
        <Info className="w-5 h-5 text-aura-accent flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-aura-text-light font-medium">API Key Required</p>
          <p className="text-aura-text-dim mt-1">
            You'll need to provide your own API key for the selected provider. 
            Add it in Settings → Integrations after creating your agent.
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button type="button" onClick={onNext}>
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
