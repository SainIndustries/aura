"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PostPaymentHandlerProps {
  agentId: string;
  onDeploy: () => void;
}

export function PostPaymentHandler({ agentId, onDeploy }: PostPaymentHandlerProps) {
  const searchParams = useSearchParams();
  const isSuccess = searchParams.get("success") === "true";
  const [hasTriggeredDeploy, setHasTriggeredDeploy] = useState(false);
  const [showSuccess, setShowSuccess] = useState(isSuccess);

  useEffect(() => {
    // Auto-trigger deployment after successful payment
    if (isSuccess && !hasTriggeredDeploy) {
      setHasTriggeredDeploy(true);
      // Small delay for UX - show success message first
      const timer = setTimeout(() => {
        onDeploy();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, hasTriggeredDeploy, onDeploy]);

  if (!showSuccess) return null;

  return (
    <Card className="border-aura-mint/30 bg-aura-mint/5 mb-6">
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-aura-mint/20 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-aura-mint" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-aura-text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-aura-mint" />
              Payment successful! Your trial has started.
            </h3>
            <p className="text-sm text-aura-text-dim mt-1">
              Deploying your agent now. This usually takes under 30 seconds.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSuccess(false)}
            className="text-aura-text-dim"
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
