"use client";

import { cn } from "@/lib/utils";

const PERSONALITIES = [
  {
    id: "cheerleader",
    label: "your personal cheerleader",
    icon: "^_^",
  },
  {
    id: "blunt",
    label: "says what you're thinking",
    icon: "-_-",
  },
  {
    id: "espresso",
    label: "runs on espresso",
    icon: ">_>",
  },
  {
    id: "curious",
    label: "down every rabbit hole",
    icon: "o_O",
  },
] as const;

export type PersonalityId = (typeof PERSONALITIES)[number]["id"];

export function StepPersonality({
  value,
  onChange,
}: {
  value: PersonalityId | null;
  onChange: (id: PersonalityId) => void;
}) {
  return (
    <div className="space-y-6 animate-fade-slide-up">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-aura-text-white">
          What&apos;s my personality?
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {PERSONALITIES.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            className={cn(
              "relative rounded-xl border p-5 text-left transition-all",
              value === p.id
                ? "border-aura-accent bg-aura-accent/10 ring-1 ring-aura-accent"
                : "border-aura-border bg-aura-surface hover:border-aura-border-hover"
            )}
          >
            <span className="block text-xs font-mono text-aura-text-ghost mb-2">
              {p.icon}
            </span>
            <span className="block text-sm font-medium text-aura-text-white">
              {p.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
