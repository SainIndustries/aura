"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink, Shield } from "lucide-react";
import type { IntegrationProvider } from "@/lib/integrations/providers";

interface IntegrationDetailProps {
  provider: IntegrationProvider;
  isConnected: boolean;
  connectedAt?: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  isLoading: boolean;
}

export function IntegrationDetail({
  provider,
  isConnected,
  connectedAt,
  open,
  onOpenChange,
  onConnect,
  onDisconnect,
  isLoading,
}: IntegrationDetailProps) {
  const Icon = provider.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-aura-border bg-aura-surface sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${provider.color}15` }}
            >
              <Icon className="h-7 w-7" style={{ color: provider.color }} />
            </div>
            <div>
              <DialogTitle className="text-xl">{provider.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {provider.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between rounded-lg bg-aura-elevated p-4">
            <div className="flex items-center gap-3">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  isConnected ? "bg-aura-mint" : "bg-aura-text-ghost"
                }`}
              />
              <span className="text-sm font-medium text-aura-text-light">
                {isConnected ? "Connected" : "Not connected"}
              </span>
            </div>
            {isConnected && connectedAt && (
              <span className="text-xs text-aura-text-dim">
                Since {new Date(connectedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Capabilities */}
          <div>
            <h4 className="mb-3 text-sm font-medium text-aura-text-light">
              Capabilities
            </h4>
            <div className="flex flex-wrap gap-2">
              {provider.capabilities.map((cap) => (
                <Badge
                  key={cap}
                  variant="secondary"
                  className="bg-aura-elevated text-aura-text-dim"
                >
                  {cap}
                </Badge>
              ))}
            </div>
          </div>

          {/* Permissions/Scopes */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-aura-accent" />
              <h4 className="text-sm font-medium text-aura-text-light">
                Permissions Required
              </h4>
            </div>
            <ul className="space-y-2">
              {provider.scopes.map((scope) => (
                <li key={scope} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-aura-mint" />
                  <span className="text-aura-text-dim">{scope}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Documentation Link */}
          {provider.docsUrl && (
            <a
              href={provider.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-aura-accent hover:text-aura-accent-bright"
            >
              <ExternalLink className="h-4 w-4" />
              View documentation
            </a>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isConnected ? (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={onDisconnect}
                disabled={isLoading}
              >
                {isLoading ? "Disconnecting..." : "Disconnect"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={onConnect} disabled={isLoading}>
                {isLoading ? "Connecting..." : "Connect"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
