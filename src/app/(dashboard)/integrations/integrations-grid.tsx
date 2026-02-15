"use client";

import { useTransition, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IntegrationCard } from "@/components/dashboard/integration-card";
import {
  integrationProviders,
  categoryMeta,
  type IntegrationCategory,
  type IntegrationProvider,
} from "@/lib/integrations/providers";
import { connectIntegration, disconnectIntegration, getOAuthUrl } from "./actions";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// Providers that use OAuth flow
const OAUTH_PROVIDERS = [
  "google",
  "slack",
  "github",
  "bitbucket",
  "vercel",
  "salesforce",
  "microsoft-teams",
  "jira",
  "notion",
  "linear",
  "zendesk",
  "xero",
  "bill-com",
  "lever",
  "workday",
];

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

// Provider display names for toast messages
const PROVIDER_NAMES: Record<string, string> = {
  google: "Google Workspace",
  slack: "Slack",
  github: "GitHub",
  elevenlabs: "ElevenLabs",
  twilio: "Twilio",
  bitbucket: "Bitbucket",
  datadog: "Datadog",
  aws: "AWS",
  vercel: "Vercel",
  railway: "Railway",
  salesforce: "Salesforce",
  "microsoft-teams": "Microsoft Teams",
  jira: "Jira",
  notion: "Notion",
  linear: "Linear",
  zendesk: "Zendesk",
  pagerduty: "PagerDuty",
  sentry: "Sentry",
  stripe: "Stripe",
  xero: "Xero",
  expensify: "Expensify",
  "bill-com": "Bill.com",
  greenhouse: "Greenhouse",
  lever: "Lever",
  bamboohr: "BambooHR",
  workday: "Workday",
};

interface IntegrationsGridProps {
  connectionMap: Map<string, { connectedAt: Date | null; id: string }>;
}

const categoryOrder: IntegrationCategory[] = [
  "communication",
  "email",
  "crm",
  "project",
  "development",
  "documentation",
  "finance",
  "hr",
  "analytics",
  "support",
  "marketing",
  "security",
];

export function IntegrationsGrid({ connectionMap }: IntegrationsGridProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<Set<IntegrationCategory>>(
    new Set()
  );
  const [showComingSoon, setShowComingSoon] = useState(true);

  // Handle success/error messages from OAuth callbacks
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success) {
      const providerName = PROVIDER_NAMES[success] || success;
      toast.success(`${providerName} connected successfully!`);
      sessionStorage.setItem('aura_pending_integration_notification', success);
      // Clean up URL
      router.replace("/integrations");
    }

    if (error) {
      const errorMessages: Record<string, string> = {
        google_not_configured: "Google OAuth is not configured",
        slack_not_configured: "Slack OAuth is not configured",
        github_not_configured: "GitHub OAuth is not configured",
        bitbucket_not_configured: "Bitbucket OAuth is not configured",
        vercel_not_configured: "Vercel OAuth is not configured",
        google_oauth_denied: "Google authorization was denied",
        slack_oauth_denied: "Slack authorization was denied",
        github_oauth_denied: "GitHub authorization was denied",
        bitbucket_oauth_denied: "Bitbucket authorization was denied",
        vercel_oauth_denied: "Vercel authorization was denied",
        invalid_callback: "Invalid OAuth callback",
        invalid_state: "Invalid security state. Please try again.",
        token_exchange_failed: "Failed to complete authorization",
        callback_failed: "An error occurred during authorization",
        oauth_failed: "Failed to start authorization",
      };
      toast.error(errorMessages[error] || "Failed to connect integration");
      // Clean up URL
      router.replace("/integrations");
    }
  }, [searchParams, router]);

  const handleConnect = async (
    providerId: string,
    credentials?: Record<string, string>
  ) => {
    // For OAuth providers, redirect to the OAuth flow
    if (OAUTH_PROVIDERS.includes(providerId)) {
      window.location.href = `/api/integrations/${providerId}`;
      return;
    }

    // For API key providers, call the specific API endpoint
    if (API_KEY_PROVIDERS.includes(providerId)) {
      try {
        const response = await fetch(`/api/integrations/${providerId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(credentials),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to connect integration");
        }

        toast.success(`${PROVIDER_NAMES[providerId] || providerId} connected successfully!`);
        sessionStorage.setItem('aura_pending_integration_notification', providerId);
        startTransition(() => {
          router.refresh();
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to connect integration"
        );
        throw error;
      }
      return;
    }

    // For non-OAuth providers, use the server action
    try {
      await connectIntegration(providerId);
      toast.success("Integration connected successfully");
      sessionStorage.setItem('aura_pending_integration_notification', providerId);
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

  // Filter providers based on search and category
  const filteredProviders = integrationProviders.filter((provider) => {
    const matchesSearch =
      searchQuery === "" ||
      provider.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      provider.capabilities.some((cap) =>
        cap.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesCategory =
      selectedCategories.size === 0 || selectedCategories.has(provider.category);

    const matchesComingSoon = showComingSoon || !provider.comingSoon;

    return matchesSearch && matchesCategory && matchesComingSoon;
  });

  // Group filtered providers by category
  const categorizedProviders = categoryOrder.reduce(
    (acc, category) => {
      const providers = filteredProviders.filter((p) => p.category === category);
      if (providers.length > 0) {
        acc[category] = providers;
      }
      return acc;
    },
    {} as Record<IntegrationCategory, IntegrationProvider[]>
  );

  const toggleCategory = (category: IntegrationCategory) => {
    const newCategories = new Set(selectedCategories);
    if (newCategories.has(category)) {
      newCategories.delete(category);
    } else {
      newCategories.add(category);
    }
    setSelectedCategories(newCategories);
  };

  const availableCount = integrationProviders.filter((p) => !p.comingSoon).length;
  const totalCount = integrationProviders.length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-aura-text-dim">
        <span>
          <span className="font-semibold text-aura-text-light">{totalCount}</span> integrations
        </span>
        <span>•</span>
        <span>
          <span className="font-semibold text-aura-mint">{availableCount}</span> available now
        </span>
        <span>•</span>
        <span>
          <span className="font-semibold text-aura-accent">{totalCount - availableCount}</span> coming soon
        </span>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-aura-text-dim" />
          <Input
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-aura-surface border-[rgba(255,255,255,0.05)]"
          />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="border-[rgba(255,255,255,0.05)] bg-aura-surface"
              >
                <Filter className="mr-2 h-4 w-4" />
                Categories
                {selectedCategories.size > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-aura-accent/20 text-aura-accent"
                  >
                    {selectedCategories.size}
                  </Badge>
                )}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 bg-aura-surface border-[rgba(255,255,255,0.05)]"
            >
              {categoryOrder.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedCategories.has(category)}
                  onCheckedChange={() => toggleCategory(category)}
                >
                  {categoryMeta[category].label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={showComingSoon ? "default" : "outline"}
            size="sm"
            onClick={() => setShowComingSoon(!showComingSoon)}
            className={
              showComingSoon
                ? "bg-aura-accent/20 text-aura-accent hover:bg-aura-accent/30"
                : "border-[rgba(255,255,255,0.05)] bg-aura-surface"
            }
          >
            Coming Soon
          </Button>
        </div>
      </div>

      {/* Selected category badges */}
      {selectedCategories.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {Array.from(selectedCategories).map((category) => (
            <Badge
              key={category}
              variant="secondary"
              className="cursor-pointer bg-aura-accent/20 text-aura-accent hover:bg-aura-accent/30"
              onClick={() => toggleCategory(category)}
            >
              {categoryMeta[category].label}
              <span className="ml-1">×</span>
            </Badge>
          ))}
          <button
            className="text-sm text-aura-text-dim hover:text-aura-text-light"
            onClick={() => setSelectedCategories(new Set())}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Integration Categories */}
      <div className="space-y-10">
        {Object.entries(categorizedProviders).map(([category, providers]) => (
          <div key={category}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-aura-text-light">
                {categoryMeta[category as IntegrationCategory].label}
              </h2>
              <p className="text-sm text-aura-text-dim">
                {categoryMeta[category as IntegrationCategory].description}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((provider) => {
                const connection = connectionMap.get(provider.id);
                return (
                  <IntegrationCard
                    key={provider.id}
                    provider={provider}
                    isConnected={!!connection}
                    connectedAt={connection?.connectedAt}
                    onConnect={(credentials) => handleConnect(provider.id, credentials)}
                    onDisconnect={() => handleDisconnect(provider.id)}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {Object.keys(categorizedProviders).length === 0 && (
          <div className="py-12 text-center">
            <p className="text-aura-text-dim">
              No integrations found matching your criteria.
            </p>
            <button
              className="mt-2 text-sm text-aura-accent hover:underline"
              onClick={() => {
                setSearchQuery("");
                setSelectedCategories(new Set());
                setShowComingSoon(true);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
