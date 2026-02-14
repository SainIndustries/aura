"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Onboarding now just redirects to agent creation
// The flow is: Sign up → Create Agent → Payment → Deploy → Connect Tools
export default function OnboardingPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to create first agent
    router.replace("/agents/new");
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-aura-accent mx-auto mb-4" />
        <p className="text-aura-text-dim">Setting up your workspace...</p>
      </div>
    </div>
  );
}
