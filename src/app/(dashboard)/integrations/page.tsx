import { Plug } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";

export default function IntegrationsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect your tools and services"
      />

      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Plug className="mb-4 h-12 w-12 text-aura-text-ghost" />
          <h3 className="mb-2 text-lg font-semibold">Coming Soon</h3>
          <p className="max-w-sm text-center text-sm text-aura-text-dim">
            Connect Slack, email, calendar, CRM, and more. Your agents will use
            these integrations to take action.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
