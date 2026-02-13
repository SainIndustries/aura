"use client";

import { useState } from "react";
import { Plug } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelCard, type ChannelType } from "@/components/dashboard/channel-card";
import { ChannelConfigModal } from "@/components/dashboard/channel-config-modal";

interface Channel {
  id: string;
  type: "web" | "slack" | "telegram" | "whatsapp" | "discord" | "email";
  name: string;
  enabled: boolean | null;
  config: Record<string, unknown> | null;
  connectedAt: Date | null;
  agent: { id: string; name: string } | null;
}

interface Agent {
  id: string;
  name: string;
}

interface ChannelsClientProps {
  initialChannels: Channel[];
  agents: Agent[];
}

const channelInfo: Record<ChannelType, { name: string; description: string; comingSoon?: boolean }> = {
  web: { name: "Web Chat", description: "Embed a chat widget on your website" },
  slack: { name: "Slack", description: "Connect to your Slack workspace" },
  telegram: { name: "Telegram", description: "Connect a Telegram bot" },
  whatsapp: { name: "WhatsApp", description: "Connect WhatsApp Business", comingSoon: true },
  discord: { name: "Discord", description: "Connect a Discord bot", comingSoon: true },
  email: { name: "Email", description: "Respond to incoming emails", comingSoon: true },
};

const availableChannels: ChannelType[] = [
  "web",
  "slack",
  "telegram",
  "whatsapp",
  "discord",
  "email",
];

export function ChannelsClient({ initialChannels }: ChannelsClientProps) {
  const [channels] = useState<Channel[]>(initialChannels);
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);

  const handleChannelClick = (type: ChannelType) => {
    const existing = channels.find((c) => c.type === type);
    if (existing) {
      setEditingChannel(existing);
    } else {
      setEditingChannel(null);
    }
    setSelectedChannel(type);
    setShowConfigModal(true);
  };

  const handleSaveChannel = async (data: {
    name: string;
    config: Record<string, unknown>;
    enabled: boolean;
  }) => {
    // TODO: Implement save channel action
    console.log("Save channel:", data);
    setShowConfigModal(false);
  };

  const handleDisconnect = async () => {
    // TODO: Implement disconnect action
    console.log("Disconnect channel:", editingChannel?.id);
    setShowConfigModal(false);
  };

  const getChannelStatus = (type: ChannelType): "connected" | "not_connected" | "coming_soon" => {
    if (channelInfo[type].comingSoon) return "coming_soon";
    const isConnected = channels.some((c) => c.type === type);
    return isConnected ? "connected" : "not_connected";
  };

  if (channels.length === 0) {
    return (
      <>
        <Card className="border-[rgba(255,255,255,0.05)] bg-aura-surface">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Plug className="mb-4 h-12 w-12 text-aura-text-ghost" />
            <h3 className="mb-2 text-lg font-semibold">No channels connected</h3>
            <p className="max-w-sm text-center text-sm text-aura-text-dim">
              Connect a channel below to start receiving and sending messages
              through your agents.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {availableChannels.map((type) => {
            const info = channelInfo[type];
            const connectedChannel = channels.find((c) => c.type === type);
            return (
              <ChannelCard
                key={type}
                type={type}
                name={info.name}
                description={info.description}
                status={getChannelStatus(type)}
                onConfigure={() => handleChannelClick(type)}
                connectedChannelName={connectedChannel?.name}
              />
            );
          })}
        </div>

        <ChannelConfigModal
          open={showConfigModal}
          onOpenChange={setShowConfigModal}
          channelType={selectedChannel}
          existingChannel={editingChannel ? {
            id: editingChannel.id,
            name: editingChannel.name,
            enabled: editingChannel.enabled === true,
            config: editingChannel.config || {},
          } : null}
          onSave={handleSaveChannel}
          onDisconnect={handleDisconnect}
        />
      </>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {availableChannels.map((type) => {
          const info = channelInfo[type];
          const connectedChannel = channels.find((c) => c.type === type);
          return (
            <ChannelCard
              key={type}
              type={type}
              name={info.name}
              description={info.description}
              status={getChannelStatus(type)}
              onConfigure={() => handleChannelClick(type)}
              connectedChannelName={connectedChannel?.name}
            />
          );
        })}
      </div>

      <ChannelConfigModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        channelType={selectedChannel}
        existingChannel={editingChannel ? {
          id: editingChannel.id,
          name: editingChannel.name,
          enabled: editingChannel.enabled === true,
          config: editingChannel.config || {},
        } : null}
        onSave={handleSaveChannel}
        onDisconnect={handleDisconnect}
      />
    </>
  );
}
