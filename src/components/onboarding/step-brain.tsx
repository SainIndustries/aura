"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Wrench, Eye, EyeOff, Loader2, CheckCircle2, ExternalLink } from "lucide-react";
import {
  LLM_PROVIDERS,
  LLM_PROVIDER_IDS,
  type LlmProviderId,
} from "@/lib/integrations/llm-providers";

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
  byokProvider,
  onByokProviderChange,
  byokModel,
  onByokModelChange,
  byokKeyValidated,
  onByokKeyValidated,
}: {
  value: BrainType;
  onChange: (id: BrainType) => void;
  byokProvider: LlmProviderId | null;
  onByokProviderChange: (id: LlmProviderId) => void;
  byokModel: string | null;
  onByokModelChange: (model: string) => void;
  byokKeyValidated: boolean;
  onByokKeyValidated: (validated: boolean) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProviderDef = byokProvider ? LLM_PROVIDERS[byokProvider] : null;

  const handleProviderChange = (id: LlmProviderId) => {
    onByokProviderChange(id);
    setApiKey("");
    setError(null);
  };

  const handleValidate = async () => {
    if (!byokProvider || !apiKey.trim()) return;
    setValidating(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/llm-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: byokProvider, apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Validation failed. Please check your key.");
        onByokKeyValidated(false);
      } else {
        onByokKeyValidated(true);
      }
    } catch {
      setError("Network error. Please try again.");
      onByokKeyValidated(false);
    } finally {
      setValidating(false);
    }
  };

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
            <div key={option.id}>
              <button
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

              {/* BYOK expansion */}
              {option.id === "byob" && value === "byob" && (
                <div className="mt-3 space-y-4 animate-fade-slide-up">
                  {/* Provider picker grid */}
                  <div className="grid grid-cols-5 gap-2">
                    {LLM_PROVIDER_IDS.map((pid) => {
                      const prov = LLM_PROVIDERS[pid];
                      return (
                        <button
                          key={pid}
                          type="button"
                          onClick={() => handleProviderChange(pid)}
                          className={cn(
                            "rounded-lg border p-2 text-center transition-all flex flex-col items-center gap-1",
                            byokProvider === pid
                              ? "border-aura-accent bg-aura-accent/10 ring-1 ring-aura-accent"
                              : "border-aura-border bg-aura-surface hover:border-aura-border-hover"
                          )}
                        >
                          <span className="text-lg">{prov.icon}</span>
                          <span className="text-xs text-aura-text-light truncate w-full">
                            {prov.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedProviderDef && (
                    <div className="space-y-3 animate-fade-slide-up">
                      {/* Model dropdown */}
                      <div>
                        <label className="block text-xs text-aura-text-dim mb-1">
                          Model
                        </label>
                        <select
                          value={byokModel || ""}
                          onChange={(e) => onByokModelChange(e.target.value)}
                          className="w-full rounded-lg border border-aura-border bg-aura-surface text-aura-text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-aura-accent focus:border-aura-accent"
                        >
                          <option value="" disabled>
                            Select a model...
                          </option>
                          {selectedProviderDef.models.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} — {m.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* API key input */}
                      <div>
                        <label className="block text-xs text-aura-text-dim mb-1">
                          API Key
                        </label>
                        <div className="relative">
                          <input
                            type={showKey ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => {
                              setApiKey(e.target.value);
                              if (byokKeyValidated) onByokKeyValidated(false);
                              setError(null);
                            }}
                            placeholder={`Paste your ${selectedProviderDef.name} API key`}
                            className="w-full rounded-lg border border-aura-border bg-aura-surface text-aura-text-white text-sm px-3 py-2 pr-10 focus:outline-none focus:ring-1 focus:ring-aura-accent focus:border-aura-accent"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-aura-text-ghost hover:text-aura-text-dim transition-colors"
                          >
                            {showKey ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Validate button */}
                      <button
                        type="button"
                        onClick={handleValidate}
                        disabled={!apiKey.trim() || validating || byokKeyValidated}
                        className={cn(
                          "w-full rounded-lg border px-4 py-2 text-sm font-medium transition-all flex items-center justify-center gap-2",
                          byokKeyValidated
                            ? "border-green-500/40 bg-green-500/10 text-green-400"
                            : "border-aura-border bg-aura-surface text-aura-text-white hover:border-aura-accent disabled:opacity-40 disabled:cursor-not-allowed"
                        )}
                      >
                        {validating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Validating...
                          </>
                        ) : byokKeyValidated ? (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            Connected
                          </>
                        ) : (
                          "Validate Key"
                        )}
                      </button>

                      {/* Error message */}
                      {error && (
                        <p className="text-xs text-red-400">{error}</p>
                      )}

                      {/* Docs link */}
                      <a
                        href={selectedProviderDef.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-aura-accent hover:text-aura-accent-bright transition-colors"
                      >
                        Get your {selectedProviderDef.name} API key
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-center text-aura-text-ghost">
        You can change this later in settings.
      </p>
    </div>
  );
}
