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
    id: "openrouter",
    name: "Aura Managed",
    models: [
      { id: "anthropic/claude-sonnet-4.5", name: "Claude Sonnet 4.5", description: "Best balance of speed and quality" },
      { id: "anthropic/claude-opus-4.6", name: "Claude Opus 4.6", description: "Most capable, complex tasks" },
      { id: "anthropic/claude-haiku-4.5", name: "Claude Haiku 4.5", description: "Fast and efficient" },
      { id: "openai/gpt-4.1", name: "GPT-4.1", description: "OpenAI's latest flagship" },
      { id: "openai/gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Fast and affordable" },
      { id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Google's most capable" },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast and cost-effective" },
      { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", description: "Meta's latest open model" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1", description: "Strong reasoning, open source" },
    ],
    icon: "🔮",
    managed: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    models: [
      { id: "gpt-4.1", name: "GPT-4.1", description: "Latest and most capable" },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", description: "Fast and affordable" },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", description: "Fastest, lowest cost" },
      { id: "o3", name: "o3", description: "Advanced reasoning model" },
      { id: "o4-mini", name: "o4-mini", description: "Fast reasoning model" },
    ],
    icon: "🤖",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    models: [
      { id: "claude-opus-4.6", name: "Claude Opus 4.6", description: "Most capable, best for complex tasks" },
      { id: "claude-sonnet-4.5", name: "Claude Sonnet 4.5", description: "Excellent balance of speed and quality" },
      { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", description: "Fast and efficient" },
    ],
    icon: "🧠",
  },
  {
    id: "google",
    name: "Google",
    models: [
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Most capable, advanced reasoning" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast and cost-effective" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Lightweight, low latency" },
    ],
    icon: "✨",
  },
  {
    id: "xai",
    name: "xAI",
    models: [
      { id: "grok-3", name: "Grok 3", description: "Most capable xAI model" },
      { id: "grok-3-mini", name: "Grok 3 Mini", description: "Fast reasoning model" },
    ],
    icon: "🅧",
  },
  {
    id: "groq",
    name: "Groq",
    models: [
      { id: "llama-4-maverick-17b-128e", name: "Llama 4 Maverick", description: "Latest Meta model, ultra fast" },
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", description: "Open source, versatile" },
      { id: "deepseek-r1-distill-llama-70b", name: "DeepSeek R1 70B", description: "Strong reasoning, open source" },
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

      {/* Provider Info */}
      {provider === "openrouter" ? (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-aura-mint/5 border border-aura-mint/20">
          <Sparkles className="w-5 h-5 text-aura-mint flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-aura-text-light font-medium">Powered by Aura — No API Key Needed</p>
            <p className="text-aura-text-dim mt-1">
              Your agent uses Aura&apos;s managed LLM infrastructure via OpenRouter.
              Usage counts against your token balance (10M included monthly).
            </p>
          </div>
        </div>
      ) : provider !== "custom" ? (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-aura-accent/5 border border-aura-accent/20">
          <Info className="w-5 h-5 text-aura-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-aura-text-light font-medium">API Key Required</p>
            <p className="text-aura-text-dim mt-1">
              You&apos;ll need to provide your own API key for {selectedProvider?.name}.
              Add it in Settings → Integrations after creating your agent.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-aura-accent/5 border border-aura-accent/20">
          <Info className="w-5 h-5 text-aura-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-aura-text-light font-medium">Custom Endpoint</p>
            <p className="text-aura-text-dim mt-1">
              Your agent will connect to your self-hosted or custom LLM endpoint.
              Make sure the endpoint is accessible from the agent&apos;s VM.
            </p>
          </div>
        </div>
      )}

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
