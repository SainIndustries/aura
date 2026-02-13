"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sparkles, Target, Zap } from "lucide-react";
import {
  type AgentTemplate,
  INTEGRATION_LABELS,
  CATEGORY_LABELS,
} from "@/lib/data/templates";

interface TemplateDetailModalProps {
  template: AgentTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateDetailModal({
  template,
  open,
  onOpenChange,
}: TemplateDetailModalProps) {
  const router = useRouter();

  if (!template) return null;

  const handleCreateAgent = () => {
    const params = new URLSearchParams({ template: template.id });
    router.push(`/agents/new?${params.toString()}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-[rgba(255,255,255,0.05)] bg-aura-surface sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-aura-elevated text-3xl">
              {template.icon}
            </div>
            <div>
              <DialogTitle className="text-xl">{template.name}</DialogTitle>
              <DialogDescription className="mt-1">
                <Badge
                  variant="secondary"
                  className="bg-aura-accent/10 text-aura-accent"
                >
                  {CATEGORY_LABELS[template.category]}
                </Badge>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <p className="text-sm text-aura-text-light">{template.description}</p>

          <Separator className="bg-aura-border" />

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-purple/10">
                <Sparkles className="h-4 w-4 text-aura-purple" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-aura-text-white">
                  Personality
                </h4>
                <p className="mt-1 text-sm text-aura-text-dim">
                  {template.personality}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-mint/10">
                <Target className="h-4 w-4 text-aura-mint" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-aura-text-white">
                  Goal
                </h4>
                <p className="mt-1 text-sm text-aura-text-dim">
                  {template.goal}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aura-amber/10">
                <Zap className="h-4 w-4 text-aura-amber" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-aura-text-white">
                  Required Integrations
                </h4>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {template.integrations.map((integration) => {
                    const info = INTEGRATION_LABELS[integration];
                    return (
                      <Badge
                        key={integration}
                        variant="secondary"
                        className={`text-xs ${info?.color ?? "bg-aura-elevated text-aura-text-dim"}`}
                      >
                        {info?.name ?? integration}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateAgent}>
            Create Agent from Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
