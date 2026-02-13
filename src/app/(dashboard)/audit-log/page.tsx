import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";

export default function AuditLogPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Log"
        description="Track all agent actions and events"
      />

      <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FileText className="mb-4 h-12 w-12 text-aura-text-ghost" />
          <h3 className="mb-2 text-lg font-semibold">Coming Soon</h3>
          <p className="max-w-sm text-center text-sm text-aura-text-dim">
            Every action your agents take will be logged here with full
            traceability and audit trails.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
