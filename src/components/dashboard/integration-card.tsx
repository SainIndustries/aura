"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IntegrationDetail } from "./integration-detail";
import type { IntegrationProvider } from "@/lib/integrations/providers";
import { Clock } from "lucide-react";

// Providers that use API key authentication
const API_KEY_PROVIDERS = [
  "elevenlabs",
  "twilio",
  "datadog",
  "aws",
  "railway",
  "pagerduty",
  "sentry",
  "stripe",
  "expensify",
  "greenhouse",
  "bamboohr",
];

interface IntegrationCardProps {
  provider: IntegrationProvider;
  isConnected: boolean;
  connectedAt?: Date | null;
  onConnect: (credentials?: Record<string, string>) => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function IntegrationCard({
  provider,
  isConnected,
  connectedAt,
  onConnect,
  onDisconnect,
}: IntegrationCardProps) {
  const [showDetail, setShowDetail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isApiKeyProvider = API_KEY_PROVIDERS.includes(provider.id);

  const handleConnect = async (credentials?: Record<string, string>) => {
    if (provider.comingSoon) return;
    setIsLoading(true);
    try {
      await onConnect(credentials);
      setShowDetail(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await onDisconnect();
    } finally {
      setIsLoading(false);
      setShowDetail(false);
    }
  };

  const handleQuickConnect = () => {
    // For API key providers, always show the detail modal
    if (isApiKeyProvider) {
      setShowDetail(true);
    } else {
      // For OAuth providers, trigger OAuth flow directly
      handleConnect();
    }
  };

  const Icon = provider.icon;

  return (
    <>
      <Card
        className={`group cursor-pointer border-[rgba(255,255,255,0.05)] bg-aura-surface transition-all hover:border-[rgba(79,143,255,0.12)] ${
          provider.comingSoon ? "opacity-75" : ""
        }`}
        onClick={() => !provider.comingSoon && setShowDetail(true)}
      >
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  provider.comingSoon ? "grayscale-[30%]" : ""
                }`}
                style={{ backgroundColor: `${provider.color}15` }}
              >
                <Icon
                  className="h-6 w-6"
                  style={{ color: provider.color }}
                />
              </div>
              <div>
                <h3 className="font-semibold text-aura-text-white">
                  {provider.name}
                </h3>
                <p className="mt-0.5 text-sm text-aura-text-dim line-clamp-1">
                  {provider.description}
                </p>
              </div>
            </div>
            {provider.comingSoon ? (
              <Badge
                variant="secondary"
                className="bg-aura-accent/20 text-aura-accent shrink-0"
              >
                <Clock className="mr-1 h-3 w-3" />
                Soon
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                className={`shrink-0 ${
                  isConnected
                    ? "bg-aura-mint/20 text-aura-mint"
                    : "bg-aura-text-dim/20 text-aura-text-dim"
                }`}
              >
                {isConnected ? "Connected" : "Available"}
              </Badge>
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {provider.capabilities.slice(0, 3).map((cap) => (
                <span
                  key={cap}
                  className="rounded-md bg-aura-elevated px-2 py-0.5 text-xs text-aura-text-dim"
                >
                  {cap}
                </span>
              ))}
              {provider.capabilities.length > 3 && (
                <span className="rounded-md bg-aura-elevated px-2 py-0.5 text-xs text-aura-text-dim">
                  +{provider.capabilities.length - 3} more
                </span>
              )}
            </div>
            {provider.comingSoon ? (
              <Button
                variant="outline"
                size="sm"
                className="opacity-0 transition-opacity group-hover:opacity-100 cursor-not-allowed"
                disabled
              >
                Coming Soon
              </Button>
            ) : (
              <Button
                variant={isConnected ? "outline" : "default"}
                size="sm"
                className="opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isConnected) {
                    setShowDetail(true);
                  } else {
                    handleQuickConnect();
                  }
                }}
                disabled={isLoading}
              >
                {isConnected ? "Manage" : "Connect"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {!provider.comingSoon && (
        <IntegrationDetail
          provider={provider}
          isConnected={isConnected}
          connectedAt={connectedAt}
          open={showDetail}
          onOpenChange={setShowDetail}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
          isLoading={isLoading}
        />
      )}
    </>
  );
}
