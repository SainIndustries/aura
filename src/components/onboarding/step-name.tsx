"use client";

import { useEffect, useRef } from "react";

export function StepName({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="space-y-6 animate-fade-slide-up">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-aura-text-white">
          Hey! Just spawned in. What&apos;s my name?
        </h2>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Luna, Jarvis, Buddy..."
        maxLength={50}
        className="w-full rounded-xl border border-aura-border bg-aura-surface px-5 py-4 text-lg text-aura-text-white placeholder:text-aura-text-ghost focus:border-aura-accent focus:outline-none focus:ring-1 focus:ring-aura-accent transition-colors"
      />
    </div>
  );
}
