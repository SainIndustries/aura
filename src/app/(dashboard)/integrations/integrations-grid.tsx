"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IntegrationCard } from "@/components/dashboard/integration-card";
import { integrationProviders } from "@/lib/integrations/providers";
import { connectIntegration, disconnectIntegration } from "./actions";
import { toast } from "sonner";

interface IntegrationsGridProps {
  connectionMap: Map<string, { connectedAt: Date | null; id: string }>;
}

export function IntegrationsGrid({ connectionMap }: IntegrationsGridProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleConnect = async (providerId: string) => {
    try {
      // In a real implementation, this would redirect to OAuth
      // For now, we'll simulate a connection
      await connectIntegration(providerId);
      toast.success("Integration connected successfully");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to connect integration"
      );
    }
  };

  const handleDisconnect = async (providerId: string) => {
    try {
      await disconnectIntegration(providerId);
      toast.success("Integration disconnected");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to disconnect integration"
      );
    }
  };

  // Group providers by category
  const categories = {
    productivity: integrationProviders.filter(
      (p) => p.category === "productivity"
    ),
    communication: integrationProviders.filter(
      (p) => p.category === "communication"
    ),
    development: integrationProviders.filter(
      (p) => p.category === "development"
    ),
    crm: integrationProviders.filter((p) => p.category === "crm"),
  };

  const categoryLabels: Record<string, string> = {
    productivity: "Productivity",
    communication: "Communication",
    development: "Development",
    crm: "CRM & Sales",
  };

  return (
    <div className="space-y-8">
      {Object.entries(categories).map(
        ([category, providers]) =>
          providers.length > 0 && (
            <div key={category}>
              <h2 className="mb-4 text-lg font-semibold text-aura-text-light">
                {categoryLabels[category]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {providers.map((provider) => {
                  const connection = connectionMap.get(provider.id);
                  return (
                    <IntegrationCard
                      key={provider.id}
                      provider={provider}
                      isConnected={!!connection}
                      connectedAt={connection?.connectedAt}
                      onConnect={() => handleConnect(provider.id)}
                      onDisconnect={() => handleDisconnect(provider.id)}
                    />
                  );
                })}
              </div>
            </div>
          )
      )}
    </div>
  );
}
