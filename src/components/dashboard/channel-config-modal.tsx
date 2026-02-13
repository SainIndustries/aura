"use client";

import { useState } from "react";
import {
  Globe,
  MessageCircle,
  Hash,
  Mail,
  Phone,
  Slack,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { WebChatEmbed } from "./web-chat-embed";
import type { ChannelType } from "./channel-card";

interface ChannelConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelType: ChannelType | null;
  existingChannel?: {
    id: string;
    name: string;
    enabled: boolean;
    config: Record<string, unknown>;
  } | null;
  onSave: (data: {
    name: string;
    config: Record<string, unknown>;
    enabled: boolean;
  }) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  onTestConnection?: (config: Record<string, unknown>) => Promise<boolean>;
}

const channelIcons: Record<ChannelType, React.ComponentType<{ className?: string }>> = {
  web: Globe,
  slack: Slack,
  telegram: MessageCircle,
  whatsapp: Phone,
  discord: Hash,
  email: Mail,
};

const channelNames: Record<ChannelType, string> = {
  web: "Web Chat",
  slack: "Slack",
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  discord: "Discord",
  email: "Email",
};

export function ChannelConfigModal({
  open,
  onOpenChange,
  channelType,
  existingChannel,
  onSave,
  onDisconnect,
  onTestConnection,
}: ChannelConfigModalProps) {
  const [name, setName] = useState(existingChannel?.name || "");
  const [enabled, setEnabled] = useState(existingChannel?.enabled ?? true);
  const [config, setConfig] = useState<Record<string, unknown>>(
    existingChannel?.config || {}
  );
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const isEditing = !!existingChannel;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ name, config, enabled });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTestConnection) return;
    setTesting(true);
    setTestResult(null);
    try {
      const success = await onTestConnection(config);
      setTestResult(success ? "success" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    setDisconnecting(true);
    try {
      await onDisconnect();
      onOpenChange(false);
    } finally {
      setDisconnecting(false);
    }
  };

  if (!channelType) return null;

  const Icon = channelIcons[channelType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[rgba(255,255,255,0.05)] bg-aura-surface sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-aura-accent/10">
              <Icon className="h-5 w-5 text-aura-accent" />
            </div>
            <div>
              <DialogTitle>
                {isEditing ? "Configure" : "Connect"} {channelNames[channelType]}
              </DialogTitle>
              <DialogDescription>
                {isEditing
                  ? "Update your channel settings"
                  : `Set up ${channelNames[channelType]} integration`}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Channel Name */}
          <div className="space-y-2">
            <Label htmlFor="channel-name">Channel Name</Label>
            <Input
              id="channel-name"
              placeholder={`My ${channelNames[channelType]}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-[rgba(255,255,255,0.1)] bg-aura-bg"
            />
            <p className="text-xs text-aura-text-dim">
              A friendly name to identify this channel
            </p>
          </div>

          {/* Channel-specific configuration */}
          <ChannelSpecificConfig
            channelType={channelType}
            config={config}
            setConfig={setConfig}
          />

          {/* Enable/Disable toggle */}
          {isEditing && (
            <div className="flex items-center justify-between rounded-lg border border-[rgba(255,255,255,0.05)] p-4">
              <div>
                <p className="font-medium text-aura-text-white">Enable Channel</p>
                <p className="text-sm text-aura-text-dim">
                  Receive messages from this channel
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          )}

          {/* Test connection result */}
          {testResult && (
            <div
              className={`rounded-lg p-3 ${
                testResult === "success"
                  ? "bg-aura-mint/10 text-aura-mint"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {testResult === "success"
                ? "✓ Connection successful!"
                : "✗ Connection failed. Please check your credentials."}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {isEditing && onDisconnect && (
            <Button
              variant="outline"
              className="border-destructive/20 text-destructive hover:bg-destructive/10 sm:mr-auto"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Disconnect
            </Button>
          )}
          {onTestConnection && channelType !== "web" && (
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || saving}
              className="border-[rgba(255,255,255,0.05)]"
            >
              {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Test Connection
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !name}
            className="bg-aura-accent hover:bg-aura-accent/90"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Save Changes" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ChannelSpecificConfigProps {
  channelType: ChannelType;
  config: Record<string, unknown>;
  setConfig: (config: Record<string, unknown>) => void;
}

function ChannelSpecificConfig({
  channelType,
  config,
  setConfig,
}: ChannelSpecificConfigProps) {
  const updateConfig = (key: string, value: unknown) => {
    setConfig({ ...config, [key]: value });
  };

  switch (channelType) {
    case "web":
      return <WebChatEmbed />;

    case "slack":
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-aura-bg/50 p-4">
            <h4 className="mb-2 font-medium text-aura-text-white">Setup Instructions</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-aura-text-dim">
              <li>Create a Slack app at api.slack.com</li>
              <li>Enable Bot Token Scopes: chat:write, channels:history</li>
              <li>Install the app to your workspace</li>
              <li>Copy the Bot Token and Signing Secret below</li>
            </ol>
            <Button
              variant="link"
              className="mt-2 h-auto p-0 text-aura-accent"
              asChild
            >
              <a
                href="https://api.slack.com/apps"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Slack API <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slack-bot-token">Bot Token</Label>
            <Input
              id="slack-bot-token"
              placeholder="xoxb-..."
              type="password"
              value={(config.botToken as string) || ""}
              onChange={(e) => updateConfig("botToken", e.target.value)}
              className="border-[rgba(255,255,255,0.1)] bg-aura-bg font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slack-signing-secret">Signing Secret</Label>
            <Input
              id="slack-signing-secret"
              placeholder="Your signing secret"
              type="password"
              value={(config.signingSecret as string) || ""}
              onChange={(e) => updateConfig("signingSecret", e.target.value)}
              className="border-[rgba(255,255,255,0.1)] bg-aura-bg font-mono"
            />
          </div>
        </div>
      );

    case "telegram":
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-aura-bg/50 p-4">
            <h4 className="mb-2 font-medium text-aura-text-white">Setup Instructions</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-aura-text-dim">
              <li>Open Telegram and search for @BotFather</li>
              <li>Send /newbot to create a new bot</li>
              <li>Follow the prompts to set a name and username</li>
              <li>Copy the API token provided by BotFather</li>
            </ol>
            <Button
              variant="link"
              className="mt-2 h-auto p-0 text-aura-accent"
              asChild
            >
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open BotFather <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram-token">Bot Token</Label>
            <Input
              id="telegram-token"
              placeholder="123456789:ABC-DEF1234..."
              type="password"
              value={(config.botToken as string) || ""}
              onChange={(e) => updateConfig("botToken", e.target.value)}
              className="border-[rgba(255,255,255,0.1)] bg-aura-bg font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telegram-allowed-users">
              Allowed User IDs (optional)
            </Label>
            <Input
              id="telegram-allowed-users"
              placeholder="123456789, 987654321"
              value={(config.allowedUsers as string) || ""}
              onChange={(e) => updateConfig("allowedUsers", e.target.value)}
              className="border-[rgba(255,255,255,0.1)] bg-aura-bg"
            />
            <p className="text-xs text-aura-text-dim">
              Comma-separated list of Telegram user IDs. Leave empty to allow all users.
            </p>
          </div>
        </div>
      );

    case "discord":
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-aura-bg/50 p-4">
            <h4 className="mb-2 font-medium text-aura-text-white">Setup Instructions</h4>
            <ol className="list-inside list-decimal space-y-1 text-sm text-aura-text-dim">
              <li>Go to the Discord Developer Portal</li>
              <li>Create a new application</li>
              <li>Go to Bot settings and create a bot</li>
              <li>Copy the Bot Token</li>
              <li>Enable Message Content Intent</li>
            </ol>
            <Button
              variant="link"
              className="mt-2 h-auto p-0 text-aura-accent"
              asChild
            >
              <a
                href="https://discord.com/developers/applications"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Discord Developer Portal{" "}
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="discord-token">Bot Token</Label>
            <Input
              id="discord-token"
              placeholder="Your Discord bot token"
              type="password"
              value={(config.botToken as string) || ""}
              onChange={(e) => updateConfig("botToken", e.target.value)}
              className="border-[rgba(255,255,255,0.1)] bg-aura-bg font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discord-guild-id">Server ID (optional)</Label>
            <Input
              id="discord-guild-id"
              placeholder="123456789012345678"
              value={(config.guildId as string) || ""}
              onChange={(e) => updateConfig("guildId", e.target.value)}
              className="border-[rgba(255,255,255,0.1)] bg-aura-bg font-mono"
            />
            <p className="text-xs text-aura-text-dim">
              Limit the bot to a specific server. Leave empty to allow all servers.
            </p>
          </div>
        </div>
      );

    case "email":
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-[rgba(255,255,255,0.05)] bg-aura-bg/50 p-4">
            <h4 className="mb-2 font-medium text-aura-text-white">Email Integration</h4>
            <p className="text-sm text-aura-text-dim">
              Connect your Gmail account to receive and respond to emails through
              your agent. This uses the Google integration from Integrations page.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-inbox">Inbox to Monitor</Label>
            <Input
              id="email-inbox"
              placeholder="INBOX"
              value={(config.inbox as string) || "INBOX"}
              onChange={(e) => updateConfig("inbox", e.target.value)}
              className="border-[rgba(255,255,255,0.1)] bg-aura-bg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-filter">Email Filter (optional)</Label>
            <Input
              id="email-filter"
              placeholder="from:support@example.com"
              value={(config.filter as string) || ""}
              onChange={(e) => updateConfig("filter", e.target.value)}
              className="border-[rgba(255,255,255,0.1)] bg-aura-bg"
            />
            <p className="text-xs text-aura-text-dim">
              Gmail search filter to limit which emails are processed
            </p>
          </div>
        </div>
      );

    default:
      return null;
  }
}
