"use client";

import { useState, useCallback, useRef } from "react";
import { useConversation, type DisconnectionDetails } from "@elevenlabs/react";

interface UseVoiceChatOptions {
  agentId: string | null;
  onUserMessage: (content: string) => void;
  onAssistantMessage: (content: string) => void;
  onError: (error: string) => void;
}

export interface UseVoiceChatReturn {
  isConnecting: boolean;
  isConnected: boolean;
  isSpeaking: boolean;
  startVoice: () => Promise<void>;
  endVoice: () => Promise<void>;
  error: string | null;
}

export function useVoiceChat({
  agentId,
  onUserMessage,
  onAssistantMessage,
  onError,
}: UseVoiceChatOptions): UseVoiceChatReturn {
  const [error, setError] = useState<string | null>(null);
  // Track whether we initiated a connection (to distinguish "connecting" from idle "disconnected")
  const connectingRef = useRef(false);

  const conversation = useConversation({
    onMessage: ({ message, role }) => {
      if (role === "user") {
        onUserMessage(message);
      } else if (role === "agent") {
        onAssistantMessage(message);
      }
    },
    onError: (message, context) => {
      console.error("[Voice] Error:", message, context);
      setError(message);
      onError(message);
      connectingRef.current = false;
    },
    onConnect: ({ conversationId }) => {
      console.log("[Voice] Connected, conversationId:", conversationId);
      connectingRef.current = false;
    },
    onDisconnect: (details: DisconnectionDetails) => {
      connectingRef.current = false;
      if (details.reason === "error") {
        console.error("[Voice] Disconnected due to error:", details.message, "closeCode:", details.closeCode, "closeReason:", details.closeReason);
        const errorMsg = details.message || "Voice session disconnected unexpectedly";
        setError(errorMsg);
        onError(errorMsg);
      } else if (details.reason === "agent") {
        console.log("[Voice] Session ended by agent", details.closeCode ? `(code: ${details.closeCode})` : "");
      } else {
        console.log("[Voice] Session ended by user");
      }
    },
    onStatusChange: ({ status }) => {
      console.log("[Voice] Status:", status);
    },
    onModeChange: ({ mode }) => {
      console.log("[Voice] Mode:", mode);
    },
  });

  const startVoice = useCallback(async () => {
    if (!agentId) {
      setError("No agent selected");
      return;
    }

    setError(null);
    connectingRef.current = true;

    try {
      // 1. Create/retrieve ElevenLabs ConvAI agent
      const agentRes = await fetch("/api/voice/elevenlabs-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      if (!agentRes.ok) {
        const err = await agentRes.json();
        throw new Error(err.error || "Failed to create voice agent");
      }

      // 2. Get signed URL
      const urlRes = await fetch("/api/voice/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });

      if (!urlRes.ok) {
        const err = await urlRes.json();
        throw new Error(err.error || "Failed to get signed URL");
      }

      const { signedUrl } = await urlRes.json();

      // 3. Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // 4. Start the ElevenLabs session
      await conversation.startSession({ signedUrl });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to start voice chat";

      // Friendly mic permission error
      if (
        message.includes("Permission denied") ||
        message.includes("NotAllowedError")
      ) {
        setError("Microphone access denied. Please allow microphone access and try again.");
      } else {
        setError(message);
      }

      onError(message);
      connectingRef.current = false;
    }
  }, [agentId, conversation, onError]);

  const endVoice = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch {
      // Session might already be ended
    }
    connectingRef.current = false;
  }, [conversation]);

  return {
    isConnecting: conversation.status === "connecting" || connectingRef.current,
    isConnected: conversation.status === "connected",
    isSpeaking: conversation.isSpeaking,
    startVoice,
    endVoice,
    error,
  };
}
