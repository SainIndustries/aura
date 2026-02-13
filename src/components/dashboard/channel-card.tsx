"use client";

import {
  Globe,
  MessageCircle,
  Hash,
  Mail,
  Phone,
  Slack,
  Settings,
  Check,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ChannelType = "web" | "slack" | "telegram" | "whatsapp" | "discord" | "email";

export interface ChannelCardProps {
  type: ChannelType;
  name: string;
  description: string;
  status: "connected" | "not_connected" | "coming_soon";
  onConfigure: () => void;
  connectedChannelName?: string;
}

const channelIcons: Record<ChannelType, React.ComponentType<{ className?: string }>> = {
  web: Globe,
  slack: Slack,
  telegram: MessageCircle,
  whatsapp: Phone,
  discord: Hash,
  email: Mail,
};

const channelColors: Record<ChannelType, string> = {
  web: "bg-aura-accent/10 text-aura-accent",
  slack: "bg-[#4A154B]/20 text-[#E01E5A]",
  telegram: "bg-[#0088cc]/20 text-[#0088cc]",
  whatsapp: "bg-[#25D366]/20 text-[#25D366]",
  discord: "bg-[#5865F2]/20 text-[#5865F2]",
  email: "bg-amber-500/20 text-amber-500",
};

const statusConfig = {
  connected: {
    badge: "bg-aura-mint/20 text-aura-mint",
    label: "Connected",
    icon: Check,
  },
  not_connected: {
    badge: "bg-aura-text-dim/20 text-aura-text-dim",
    label: "Not Connected",
    icon: null,
  },
  coming_soon: {
    badge: "bg-aura-amber/20 text-aura-amber",
    label: "Coming Soon",
    icon: Clock,
  },
};

export function ChannelCard({
  type,
  name,
  description,
  status,
  onConfigure,
  connectedChannelName,
}: ChannelCardProps) {
  const Icon = channelIcons[type];
  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="group border-[rgba(255,255,255,0.05)] bg-aura-surface transition-all hover:border-[rgba(79,143,255,0.12)]">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${channelColors[type]}`}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-aura-text-white">{name}</h3>
              <p className="mt-0.5 text-sm text-aura-text-dim">{description}</p>
            </div>
          </div>
          <Badge variant="secondary" className={statusInfo.badge}>
            {StatusIcon && <StatusIcon className="mr-1 h-3 w-3" />}
            {statusInfo.label}
          </Badge>
        </div>

        {connectedChannelName && status === "connected" && (
          <div className="mt-4 rounded-lg bg-aura-bg/50 px-3 py-2">
            <p className="text-xs text-aura-text-dim">Connected as:</p>
            <p className="text-sm text-aura-text-light">{connectedChannelName}</p>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {status === "coming_soon" ? (
            <Button
              variant="outline"
              className="w-full border-[rgba(255,255,255,0.05)] text-aura-text-dim"
              disabled
            >
              Coming Soon
            </Button>
          ) : (
            <Button
              variant={status === "connected" ? "outline" : "default"}
              className={
                status === "connected"
                  ? "w-full border-[rgba(255,255,255,0.05)]"
                  : "w-full bg-aura-accent hover:bg-aura-accent/90"
              }
              onClick={onConfigure}
            >
              {status === "connected" ? (
                <>
                  <Settings className="mr-2 h-4 w-4" />
                  Configure
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
