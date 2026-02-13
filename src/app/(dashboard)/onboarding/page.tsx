"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronRight,
  Plug,
  Bot,
  MessageSquare,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const steps = [
  {
    id: "welcome",
    title: "Welcome to Aura",
    description: "Let's get you set up in just a few minutes.",
    icon: Sparkles,
  },
  {
    id: "integrations",
    title: "Connect your tools",
    description: "Link the apps you use daily so Aura can work across them.",
    icon: Plug,
    action: {
      label: "Connect Integrations",
      href: "/integrations",
    },
    tips: [
      "Start with Google Calendar and Gmail for scheduling",
      "Add Slack or your team chat for communications",
      "Connect your CRM for pipeline automation",
    ],
  },
  {
    id: "agent",
    title: "Create your first agent",
    description: "Choose a template or build a custom AI agent for your workflow.",
    icon: Bot,
    action: {
      label: "Browse Templates",
      href: "/templates",
    },
    tips: [
      "Templates are pre-configured for common use cases",
      "You can customize any template after creating it",
      "Start simple — you can always add more capabilities later",
    ],
  },
  {
    id: "channels",
    title: "Set up a channel",
    description: "Choose how you want to communicate with your AI assistant.",
    icon: MessageSquare,
    action: {
      label: "Configure Channels",
      href: "/channels",
    },
    tips: [
      "Web chat is enabled by default",
      "Add Slack, Telegram, or WhatsApp for mobile access",
      "Phone channel lets you call your AI directly",
    ],
  },
  {
    id: "complete",
    title: "You're all set!",
    description: "Your AI assistant is ready to help you operate.",
    icon: Check,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const markComplete = () => {
    if (!completedSteps.includes(step.id)) {
      setCompletedSteps([...completedSteps, step.id]);
    }
  };

  const goNext = () => {
    markComplete();
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToDashboard = () => {
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex">
      {/* Left sidebar - Progress */}
      <div className="w-72 border-r border-aura-border bg-aura-surface/50 p-6 hidden lg:block">
        <h2 className="text-sm font-semibold text-aura-text-dim uppercase tracking-wider mb-6">
          Setup Progress
        </h2>
        <div className="space-y-2">
          {steps.map((s, index) => {
            const isComplete = completedSteps.includes(s.id);
            const isCurrent = index === currentStep;
            return (
              <button
                key={s.id}
                onClick={() => setCurrentStep(index)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                  isCurrent
                    ? "bg-aura-accent/10 text-aura-accent"
                    : isComplete
                    ? "text-aura-text-light hover:bg-aura-elevated"
                    : "text-aura-text-dim hover:bg-aura-elevated"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                    isCurrent
                      ? "bg-aura-accent text-white"
                      : isComplete
                      ? "bg-aura-mint/20 text-aura-mint"
                      : "bg-aura-elevated text-aura-text-dim"
                  )}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className="font-medium">{s.title}</span>
              </button>
            );
          })}
        </div>
        
        <div className="mt-8 pt-6 border-t border-aura-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-aura-text-dim hover:text-aura-text-light"
            onClick={goToDashboard}
          >
            Skip for now
            <ChevronRight className="w-4 h-4 ml-auto" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Mobile progress bar */}
        <div className="lg:hidden p-4 border-b border-aura-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-aura-text-dim">
              Step {currentStep + 1} of {steps.length}
            </span>
            <Button variant="ghost" size="sm" onClick={goToDashboard}>
              Skip
            </Button>
          </div>
          <div className="h-1 bg-aura-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-aura-accent transition-all"
              style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-xl w-full">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-aura-accent/10 text-aura-accent flex items-center justify-center mx-auto mb-6">
                <step.icon className="w-8 h-8" />
              </div>
              <h1 className="text-3xl font-bold text-aura-text-white mb-3">
                {step.title}
              </h1>
              <p className="text-lg text-aura-text-dim">{step.description}</p>
            </div>

            {/* Tips */}
            {"tips" in step && step.tips && (
              <div className="bg-aura-surface border border-aura-border rounded-xl p-6 mb-8">
                <h3 className="text-sm font-semibold text-aura-text-light mb-4">
                  Tips for this step:
                </h3>
                <ul className="space-y-3">
                  {step.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-3 text-aura-text-dim">
                      <Check className="w-5 h-5 text-aura-mint flex-shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action button */}
            {"action" in step && step.action && (
              <Link href={step.action.href}>
                <Button
                  size="lg"
                  className="w-full bg-aura-accent hover:bg-aura-accent-bright text-white mb-4"
                >
                  {step.action.label}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="ghost"
                onClick={goBack}
                disabled={isFirstStep}
                className={isFirstStep ? "invisible" : ""}
              >
                Back
              </Button>

              {isLastStep ? (
                <Button
                  onClick={goToDashboard}
                  className="bg-aura-mint hover:bg-aura-mint/90 text-black"
                >
                  Go to Dashboard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={goNext}>
                  {isFirstStep ? "Get Started" : "Continue"}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
