"use client";

import { cn } from "@/lib/utils";

const WRITING_STYLES = [
  {
    id: "lowercase",
    label: "no caps, no stress",
    emoji: "~",
  },
  {
    id: "polished",
    label: "crisp & polished",
    emoji: ".",
  },
  {
    id: "texting",
    label: "like texting a friend",
    emoji: "!",
  },
  {
    id: "unhinged",
    label: "delightfully unhinged",
    emoji: "*",
  },
] as const;

export type WritingStyleId = (typeof WRITING_STYLES)[number]["id"];

export function StepWritingStyle({
  value,
  onChange,
}: {
  value: WritingStyleId | null;
  onChange: (id: WritingStyleId) => void;
}) {
  return (
    <div className="space-y-6 animate-fade-slide-up">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-aura-text-white">
          How should I write?
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {WRITING_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => onChange(style.id)}
            className={cn(
              "relative rounded-xl border p-5 text-left transition-all",
              value === style.id
                ? "border-aura-accent bg-aura-accent/10 ring-1 ring-aura-accent"
                : "border-aura-border bg-aura-surface hover:border-aura-border-hover"
            )}
          >
            <span className="block text-xs font-mono text-aura-text-ghost mb-2">
              {style.emoji}
            </span>
            <span className="block text-sm font-medium text-aura-text-white">
              {style.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
