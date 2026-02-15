"use client";

import { useReducer, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Mascot } from "./mascot";
import { StepName } from "./step-name";
import { StepWritingStyle, type WritingStyleId } from "./step-writing-style";
import { StepPersonality, type PersonalityId } from "./step-personality";
import { StepBrain, type BrainType } from "./step-brain";
import { StepDeploying } from "./step-deploying";
import { createAgent } from "@/app/(dashboard)/agents/actions";

const TOTAL_STEPS = 4;

type WizardState = {
  step: number;
  name: string;
  writingStyle: WritingStyleId | null;
  personality: PersonalityId | null;
  brainType: BrainType;
};

type WizardAction =
  | { type: "SET_NAME"; payload: string }
  | { type: "SET_WRITING_STYLE"; payload: WritingStyleId }
  | { type: "SET_PERSONALITY"; payload: PersonalityId }
  | { type: "SET_BRAIN_TYPE"; payload: BrainType }
  | { type: "NEXT" }
  | { type: "BACK" };

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_NAME":
      return { ...state, name: action.payload };
    case "SET_WRITING_STYLE":
      return { ...state, writingStyle: action.payload };
    case "SET_PERSONALITY":
      return { ...state, personality: action.payload };
    case "SET_BRAIN_TYPE":
      return { ...state, brainType: action.payload };
    case "NEXT":
      return { ...state, step: Math.min(state.step + 1, TOTAL_STEPS - 1) };
    case "BACK":
      return { ...state, step: Math.max(state.step - 1, 0) };
    default:
      return state;
  }
}

const WRITING_STYLE_PROMPTS: Record<WritingStyleId, string> = {
  lowercase:
    "Write in all lowercase. Keep it relaxed and chill. No formal punctuation needed.",
  polished:
    "Write with proper grammar, clean punctuation, and a polished professional tone.",
  texting:
    "Write casually like you're texting a close friend. Use abbreviations, slang, and keep it short.",
  unhinged:
    "Write with chaotic energy. Use caps for emphasis, throw in tangents, be dramatic and expressive.",
};

const PERSONALITY_PROMPTS: Record<PersonalityId, string> = {
  cheerleader:
    "You're a personal cheerleader. Always supportive, encouraging, and uplifting. Celebrate every win, no matter how small.",
  blunt:
    "You're brutally honest and direct. You say what others are thinking but won't say. No sugar-coating.",
  espresso:
    "You're high-energy and always moving fast. Keep things snappy, efficient, and action-oriented.",
  curious:
    "You're endlessly curious. You love exploring ideas, making unexpected connections, and going deep on any topic.",
};

function composePersonality(
  writingStyle: WritingStyleId | null,
  personality: PersonalityId | null
): string {
  const parts: string[] = [];
  if (writingStyle) parts.push(WRITING_STYLE_PROMPTS[writingStyle]);
  if (personality) parts.push(PERSONALITY_PROMPTS[personality]);
  return parts.join(" ");
}

function canContinue(state: WizardState): boolean {
  switch (state.step) {
    case 0:
      return state.name.trim().length > 0;
    case 1:
      return state.writingStyle !== null;
    case 2:
      return state.personality !== null;
    case 3:
      return true; // pre-selected default
    default:
      return false;
  }
}

export function AgentWizard() {
  const searchParams = useSearchParams();
  const returnAgentId = searchParams.get("agentId");
  const isSuccess = searchParams.get("success") === "true";

  // If returning from Stripe, skip wizard and show deploying
  if (returnAgentId && isSuccess) {
    return <StepDeploying agentId={returnAgentId} />;
  }

  return <WizardFlow />;
}

function WizardFlow() {
  const [state, dispatch] = useReducer(reducer, {
    step: 0,
    name: "",
    writingStyle: null,
    personality: null,
    brainType: "managed",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLast = state.step === TOTAL_STEPS - 1;

  const handleContinue = async () => {
    if (!canContinue(state)) return;

    if (isLast) {
      setIsSubmitting(true);
      try {
        const llmModel =
          state.brainType === "managed"
            ? "anthropic/claude-sonnet-4.5"
            : "";
        const llmProvider =
          state.brainType === "managed" ? "openrouter" : "custom";

        await createAgent({
          name: state.name.trim(),
          description: "",
          personality: composePersonality(
            state.writingStyle,
            state.personality
          ),
          goal: "",
          heartbeatEnabled: false,
          heartbeatCron: "",
          llmProvider,
          llmModel,
          llmTemperature: 0.7,
          llmCustomEndpoint: "",
        });
      } catch {
        setIsSubmitting(false);
      }
    } else {
      dispatch({ type: "NEXT" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canContinue(state)) {
      e.preventDefault();
      handleContinue();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-aura-void flex flex-col items-center justify-center px-4"
      onKeyDown={handleKeyDown}
    >
      <div className="w-full max-w-md space-y-8">
        {/* Mascot + Agent name */}
        <div className="flex flex-col items-center gap-3">
          <Mascot size={96} className="animate-float" />
          {state.step > 0 && state.name && (
            <p className="text-sm font-medium text-aura-accent">
              {state.name}
            </p>
          )}
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === state.step
                  ? "w-6 bg-aura-accent"
                  : i < state.step
                    ? "w-2 bg-aura-accent/50"
                    : "w-2 bg-aura-border"
              }`}
            />
          ))}
        </div>

        {/* Current step */}
        <div key={state.step}>
          {state.step === 0 && (
            <StepName
              value={state.name}
              onChange={(v) => dispatch({ type: "SET_NAME", payload: v })}
            />
          )}
          {state.step === 1 && (
            <StepWritingStyle
              value={state.writingStyle}
              onChange={(v) =>
                dispatch({ type: "SET_WRITING_STYLE", payload: v })
              }
            />
          )}
          {state.step === 2 && (
            <StepPersonality
              value={state.personality}
              onChange={(v) =>
                dispatch({ type: "SET_PERSONALITY", payload: v })
              }
            />
          )}
          {state.step === 3 && (
            <StepBrain
              value={state.brainType}
              onChange={(v) =>
                dispatch({ type: "SET_BRAIN_TYPE", payload: v })
              }
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          {state.step > 0 ? (
            <button
              type="button"
              onClick={() => dispatch({ type: "BACK" })}
              className="flex items-center gap-1 text-sm text-aura-text-dim hover:text-aura-text-light transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={handleContinue}
            disabled={!canContinue(state) || isSubmitting}
            className="rounded-full bg-aura-accent text-white px-6 py-2.5 text-sm font-medium hover:bg-aura-accent-bright disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : isLast ? (
              "Start Free Trial"
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
