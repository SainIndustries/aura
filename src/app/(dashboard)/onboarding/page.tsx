"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AgentWizard } from "@/components/onboarding/agent-wizard";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 bg-aura-void flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-aura-accent" />
        </div>
      }
    >
      <AgentWizard />
    </Suspense>
  );
}
