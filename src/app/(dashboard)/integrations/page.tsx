import { Suspense } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { IntegrationsGrid } from "./integrations-grid";
import { getUserIntegrations } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";

export default async function IntegrationsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Connect your tools and services to supercharge your agents"
      />

      <Suspense fallback={<IntegrationsGridSkeleton />}>
        <IntegrationsContent />
      </Suspense>
    </div>
  );
}

async function IntegrationsContent() {
  const userIntegrations = await getUserIntegrations();
  
  // Map provider id to connection info
  const connectionMap = new Map(
    userIntegrations.map((i) => [
      i.provider,
      { connectedAt: i.connectedAt, id: i.id },
    ])
  );

  return <IntegrationsGrid connectionMap={connectionMap} />;
}

function IntegrationsGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[rgba(255,255,255,0.05)] bg-aura-surface p-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div>
                <Skeleton className="mb-2 h-5 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
