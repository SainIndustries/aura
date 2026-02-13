"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import {
  type AgentTemplate,
  INTEGRATION_LABELS,
} from "@/lib/data/templates";

interface TemplateCardProps {
  template: AgentTemplate;
  onSelect: (template: AgentTemplate) => void;
}

export function TemplateCard({ template, onSelect }: TemplateCardProps) {
  return (
    <Card className="group relative flex flex-col border-[rgba(255,255,255,0.05)] bg-aura-surface transition-all duration-300 hover:border-[rgba(79,143,255,0.12)] card-hover">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aura-elevated text-2xl">
            {template.icon}
          </div>
        </div>
        <h3 className="mt-3 text-lg font-semibold text-aura-text-white">
          {template.name}
        </h3>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="mb-4 flex-1 text-sm text-aura-text-dim">
          {template.description}
        </p>
        <div className="mb-4 flex flex-wrap gap-1.5">
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
        <Button
          onClick={() => onSelect(template)}
          className="w-full justify-between bg-aura-accent/10 text-aura-accent hover:bg-aura-accent/20"
        >
          Use Template
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
