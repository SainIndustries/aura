import { LayoutTemplate } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";

export default function TemplatesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Templates"
        description="Pre-built agent configurations"
      />

      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <LayoutTemplate className="mb-4 h-12 w-12 text-aura-text-ghost" />
          <h3 className="mb-2 text-lg font-semibold">Coming Soon</h3>
          <p className="max-w-sm text-center text-sm text-aura-text-dim">
            Agent templates will be available here. Start from pre-configured
            agents for common use cases.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
