"use client";

import { PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VoiceModePanelProps {
  isConnecting: boolean;
  isConnected: boolean;
  isSpeaking: boolean;
  error: string | null;
  onEnd: () => void;
}

export function VoiceModePanel({
  isConnecting,
  isConnected,
  isSpeaking,
  error,
  onEnd,
}: VoiceModePanelProps) {
  const statusText = error
    ? error
    : isConnecting
      ? "Connecting..."
      : isSpeaking
        ? "Speaking..."
        : isConnected
          ? "Listening..."
          : "Disconnected";

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Animated orb */}
      <div className="relative flex items-center justify-center">
        {/* Outer pulse ring */}
        <div
          className={cn(
            "absolute w-24 h-24 rounded-full transition-all duration-500",
            isConnecting && "bg-aura-accent/10 animate-pulse",
            isConnected && !isSpeaking && "bg-aura-accent/10 animate-pulse",
            isSpeaking && "bg-aura-accent/20 scale-125 animate-pulse",
            error && "bg-red-500/10",
          )}
        />
        {/* Inner orb */}
        <div
          className={cn(
            "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300",
            isConnecting && "bg-aura-accent/30",
            isConnected && !isSpeaking && "bg-aura-accent/40",
            isSpeaking && "bg-aura-accent/60 scale-110",
            error && "bg-red-500/30",
            !isConnecting && !isConnected && !error && "bg-aura-accent/20",
          )}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full transition-all duration-200",
              isConnecting && "bg-aura-accent/60 animate-spin",
              isConnected && !isSpeaking && "bg-aura-accent animate-pulse",
              isSpeaking && "bg-aura-accent scale-110",
              error && "bg-red-500/60",
              !isConnecting && !isConnected && !error && "bg-aura-accent/40",
            )}
          />
        </div>
      </div>

      {/* Status text */}
      <p
        className={cn(
          "text-sm font-medium",
          error ? "text-red-400" : "text-aura-text-dim",
        )}
      >
        {statusText}
      </p>

      {/* End voice button */}
      {(isConnected || isConnecting) && (
        <Button
          onClick={onEnd}
          variant="destructive"
          className="rounded-full px-6 gap-2"
        >
          <PhoneOff className="w-4 h-4" />
          End Voice Chat
        </Button>
      )}
    </div>
  );
}
