"use client";

import { cn } from "@/lib/utils";
import { Sparkles, Wrench } from "lucide-react";

export type BrainType = "managed" | "byob";

const BRAIN_OPTIONS = [
  {
    id: "managed" as BrainType,
    label: "Aura Managed",
    description: "We handle the AI infrastructure. Powered by top-tier models via OpenRouter.",
    icon: Sparkles,
  },
  {
    id: "byob" as BrainType,
    label: "Bring Your Own Brain",
    description: "Use your own LLM provider and API key. Configure in settings after setup.",
    icon: Wrench,
  },
] as const;

export function StepBrain({
  value,
  onChange,
}: {
  value: BrainType;
  onChange: (id: BrainType) => void;
}) {
  return (
    <div className="space-y-6 animate-fade-slide-up">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-aura-text-white">
          Choose my brain!
        </h2>
        <p className="text-sm text-aura-text-dim">
          How should I be powered?
        </p>
      </div>
      <div className="space-y-3">
        {BRAIN_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "w-full rounded-xl border p-4 sm:p-5 text-left transition-all flex items-center gap-3 sm:gap-4",
                value === option.id
                  ? "border-aura-accent bg-aura-accent/10 ring-1 ring-aura-accent"
                  : "border-aura-border bg-aura-surface hover:border-aura-border-hover"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                  value === option.id
                    ? "bg-aura-accent/20 text-aura-accent"
                    : "bg-aura-elevated text-aura-text-dim"
                )}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="block font-medium text-aura-text-white">
                  {option.label}
                </span>
                <p className="text-sm text-aura-text-dim mt-1">
                  {option.description}
                </p>
              </div>
              <div
                className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                  value === option.id
                    ? "border-aura-accent"
                    : "border-aura-text-ghost"
                )}
              >
                {value === option.id && (
                  <div className="w-2.5 h-2.5 rounded-full bg-aura-accent" />
                )}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-center text-aura-text-ghost">
        You can change this later in settings.
      </p>
    </div>
  );
}
