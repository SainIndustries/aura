import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpgradeBanner() {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[rgba(79,143,255,0.12)] bg-gradient-to-r from-[rgba(79,143,255,0.06)] to-[rgba(124,92,252,0.04)] px-6 py-4">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-aura-accent" />
        <div>
          <p className="text-sm font-medium">
            Start your 14-day free trial
          </p>
          <p className="text-xs text-aura-text-dim">
            Get full access to all Aura features. $299/month after trial.
          </p>
        </div>
      </div>
      <Button asChild size="sm">
        <Link href="/settings">Upgrade</Link>
      </Button>
    </div>
  );
}
