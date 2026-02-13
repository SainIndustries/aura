"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ExternalLink, Shield, Eye, EyeOff, AlertCircle } from "lucide-react";
import type { IntegrationProvider } from "@/lib/integrations/providers";

// Providers that use API key authentication instead of OAuth
const API_KEY_PROVIDERS = ["elevenlabs", "twilio", "datadog", "aws", "railway"];

interface IntegrationDetailProps {
  provider: IntegrationProvider;
  isConnected: boolean;
  connectedAt?: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (credentials?: Record<string, string>) => Promise<void>;
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
  const isApiKeyProvider = API_KEY_PROVIDERS.includes(provider.id);

  // State for API key form
  const [apiKey, setApiKey] = useState("");
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [applicationKey, setApplicationKey] = useState("");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [showApplicationKey, setShowApplicationKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setError("");

    if (isApiKeyProvider) {
      if (provider.id === "elevenlabs") {
        if (!apiKey.trim()) {
          setError("API key is required");
          return;
        }
        await onConnect({ apiKey: apiKey.trim() });
      } else if (provider.id === "twilio") {
        if (!accountSid.trim()) {
          setError("Account SID is required");
          return;
        }
        if (!authToken.trim()) {
          setError("Auth Token is required");
          return;
        }
        await onConnect({
          accountSid: accountSid.trim(),
          authToken: authToken.trim(),
        });
      } else if (provider.id === "datadog") {
        if (!apiKey.trim()) {
          setError("API Key is required");
          return;
        }
        const credentials: Record<string, string> = { apiKey: apiKey.trim() };
        if (applicationKey.trim()) {
          credentials.applicationKey = applicationKey.trim();
        }
        await onConnect(credentials);
      } else if (provider.id === "aws") {
        if (!accessKeyId.trim()) {
          setError("Access Key ID is required");
          return;
        }
        if (!secretAccessKey.trim()) {
          setError("Secret Access Key is required");
          return;
        }
        await onConnect({
          accessKeyId: accessKeyId.trim(),
          secretAccessKey: secretAccessKey.trim(),
        });
      } else if (provider.id === "railway") {
        if (!apiKey.trim()) {
          setError("API Token is required");
          return;
        }
        await onConnect({ apiToken: apiKey.trim() });
      }
    } else {
      await onConnect();
    }
  };

  const handleDisconnect = async () => {
    await onDisconnect();
    // Reset form
    setApiKey("");
    setAccountSid("");
    setAuthToken("");
    setApplicationKey("");
    setAccessKeyId("");
    setSecretAccessKey("");
    setError("");
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset form when closing
      setApiKey("");
      setAccountSid("");
      setAuthToken("");
      setApplicationKey("");
      setAccessKeyId("");
      setSecretAccessKey("");
      setError("");
      setShowApiKey(false);
      setShowAuthToken(false);
      setShowApplicationKey(false);
      setShowSecretKey(false);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

          {/* API Key Form for non-connected API key providers */}
          {isApiKeyProvider && !isConnected && (
            <div className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}

              {provider.id === "elevenlabs" && (
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-aura-text-light">
                    API Key
                  </Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      placeholder="Enter your ElevenLabs API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10 bg-aura-elevated border-[rgba(255,255,255,0.05)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-aura-text-dim hover:text-aura-text-light"
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-aura-text-dim">
                    Find your API key at{" "}
                    <a
                      href="https://elevenlabs.io/app/settings/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-aura-accent hover:underline"
                    >
                      elevenlabs.io/app/settings/api-keys
                    </a>
                  </p>
                </div>
              )}

              {provider.id === "twilio" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="accountSid" className="text-aura-text-light">
                      Account SID
                    </Label>
                    <Input
                      id="accountSid"
                      type="text"
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={accountSid}
                      onChange={(e) => setAccountSid(e.target.value)}
                      className="bg-aura-elevated border-[rgba(255,255,255,0.05)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="authToken" className="text-aura-text-light">
                      Auth Token
                    </Label>
                    <div className="relative">
                      <Input
                        id="authToken"
                        type={showAuthToken ? "text" : "password"}
                        placeholder="Enter your Auth Token"
                        value={authToken}
                        onChange={(e) => setAuthToken(e.target.value)}
                        className="pr-10 bg-aura-elevated border-[rgba(255,255,255,0.05)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAuthToken(!showAuthToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-aura-text-dim hover:text-aura-text-light"
                      >
                        {showAuthToken ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-aura-text-dim">
                    Find your credentials at{" "}
                    <a
                      href="https://console.twilio.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-aura-accent hover:underline"
                    >
                      console.twilio.com
                    </a>
                  </p>
                </>
              )}

              {provider.id === "datadog" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="apiKey" className="text-aura-text-light">
                      API Key
                    </Label>
                    <div className="relative">
                      <Input
                        id="apiKey"
                        type={showApiKey ? "text" : "password"}
                        placeholder="Enter your Datadog API key"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="pr-10 bg-aura-elevated border-[rgba(255,255,255,0.05)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-aura-text-dim hover:text-aura-text-light"
                      >
                        {showApiKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="applicationKey" className="text-aura-text-light">
                      Application Key <span className="text-aura-text-dim">(optional)</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="applicationKey"
                        type={showApplicationKey ? "text" : "password"}
                        placeholder="Enter your Datadog Application key"
                        value={applicationKey}
                        onChange={(e) => setApplicationKey(e.target.value)}
                        className="pr-10 bg-aura-elevated border-[rgba(255,255,255,0.05)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApplicationKey(!showApplicationKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-aura-text-dim hover:text-aura-text-light"
                      >
                        {showApplicationKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-aura-text-dim">
                    Find your keys at{" "}
                    <a
                      href="https://app.datadoghq.com/organization-settings/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-aura-accent hover:underline"
                    >
                      app.datadoghq.com/organization-settings/api-keys
                    </a>
                  </p>
                </>
              )}

              {provider.id === "aws" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="accessKeyId" className="text-aura-text-light">
                      Access Key ID
                    </Label>
                    <Input
                      id="accessKeyId"
                      type="text"
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      value={accessKeyId}
                      onChange={(e) => setAccessKeyId(e.target.value)}
                      className="bg-aura-elevated border-[rgba(255,255,255,0.05)]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secretAccessKey" className="text-aura-text-light">
                      Secret Access Key
                    </Label>
                    <div className="relative">
                      <Input
                        id="secretAccessKey"
                        type={showSecretKey ? "text" : "password"}
                        placeholder="Enter your Secret Access Key"
                        value={secretAccessKey}
                        onChange={(e) => setSecretAccessKey(e.target.value)}
                        className="pr-10 bg-aura-elevated border-[rgba(255,255,255,0.05)]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecretKey(!showSecretKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-aura-text-dim hover:text-aura-text-light"
                      >
                        {showSecretKey ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-aura-text-dim">
                    Create an IAM user with appropriate permissions at{" "}
                    <a
                      href="https://console.aws.amazon.com/iam"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-aura-accent hover:underline"
                    >
                      console.aws.amazon.com/iam
                    </a>
                  </p>
                </>
              )}

              {provider.id === "railway" && (
                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-aura-text-light">
                    API Token
                  </Label>
                  <div className="relative">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      placeholder="Enter your Railway API token"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pr-10 bg-aura-elevated border-[rgba(255,255,255,0.05)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-aura-text-dim hover:text-aura-text-light"
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-aura-text-dim">
                    Generate a token at{" "}
                    <a
                      href="https://railway.app/account/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-aura-accent hover:underline"
                    >
                      railway.app/account/tokens
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}

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
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Close
              </Button>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isLoading}
              >
                {isLoading ? "Disconnecting..." : "Disconnect"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleConnect} disabled={isLoading}>
                {isLoading ? "Connecting..." : "Connect"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
