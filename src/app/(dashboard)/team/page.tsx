import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PageHeader } from "@/components/dashboard/page-header";
import { TeamPageClient } from "./team-client";
import { Skeleton } from "@/components/ui/skeleton";

export default async function TeamPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="space-y-8">
        <PageHeader
          title="Team"
          description="Manage your workspace team members"
        />
        <div className="text-center py-12">
          <p className="text-aura-text-dim">Please sign in to view your team</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Suspense fallback={<TeamPageSkeleton />}>
        <TeamPageClient currentUserId={user.id} />
      </Suspense>
    </div>
  );
}

function TeamPageSkeleton() {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </>
  );
}
