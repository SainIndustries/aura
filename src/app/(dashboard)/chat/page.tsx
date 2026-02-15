"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import NextLink from "next/link";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  Bot,
  Loader2,
  Sparkles,
  Mail,
  Hash,
  MessageCircle,
  Rocket,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  integrationProviders,
  categoryMeta,
  type IntegrationCategory,
} from "@/lib/integrations/providers";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAgentStatus } from "@/components/providers/agent-status-provider";

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => ISpeechRecognition;
    webkitSpeechRecognition?: new () => ISpeechRecognition;
  }
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export default function ChatPage() {
  const { user } = usePrivy();
  const searchParams = useSearchParams();
  const { hasRunningAgent, agentName, agents, selectedAgentId, setSelectedAgentId, refresh } = useAgentStatus();
  const [statusChecked, setStatusChecked] = useState(false);

  // Re-check agent status on mount (provider may have stale data from before provisioning)
  useEffect(() => {
    refresh().then(() => setStatusChecked(true));
  }, [refresh]);

  // If agentId is in the URL (e.g. from "Start Chatting" after wizard), select that agent
  useEffect(() => {
    const agentIdParam = searchParams.get("agentId");
    if (agentIdParam && agents.some((a) => a.id === agentIdParam)) {
      setSelectedAgentId(agentIdParam);
    }
  }, [searchParams, agents, setSelectedAgentId]);
  // --- Per-agent chat history (persisted to sessionStorage) ---

  const STORAGE_KEY = "aura_chat_messages";

  function loadStoredMessages(agentId: string): Message[] {
    try {
      const raw = sessionStorage.getItem(`${STORAGE_KEY}:${agentId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Message[];
      // Rehydrate Date objects
      return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
    } catch {
      return [];
    }
  }

  function saveStoredMessages(agentId: string, msgs: Message[]) {
    try {
      sessionStorage.setItem(`${STORAGE_KEY}:${agentId}`, JSON.stringify(msgs));
    } catch { /* storage full or unavailable */ }
  }

  const [messages, setMessages] = useState<Message[]>(() =>
    selectedAgentId ? loadStoredMessages(selectedAgentId) : []
  );
  const prevAgentIdRef = useRef<string | null>(selectedAgentId);

  // Save/load messages when switching agents
  useEffect(() => {
    const prevId = prevAgentIdRef.current;
    // Save current messages under the previous agent
    if (prevId && prevId !== selectedAgentId) {
      saveStoredMessages(prevId, messages);
    }
    // Load messages for the new agent
    if (selectedAgentId && selectedAgentId !== prevId) {
      setMessages(loadStoredMessages(selectedAgentId));
    }
    prevAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist messages on every update
  useEffect(() => {
    if (selectedAgentId) {
      saveStoredMessages(selectedAgentId, messages);
    }
  }, [messages, selectedAgentId]);

  // Initialize / update welcome message when agentName changes
  useEffect(() => {
    setMessages((prev) => {
      const welcomeContent = `Hey! I'm ${agentName ?? "your AI assistant"}. How can I help you today? You can type or use voice to talk to me.`;
      const existing = prev.find((m) => m.id === "welcome");
      if (!existing) {
        return [
          { id: "welcome", role: "assistant" as const, content: welcomeContent, timestamp: new Date() },
          ...prev,
        ];
      }
      if (existing.content !== welcomeContent) {
        return prev.map((m) => (m.id === "welcome" ? { ...m, content: welcomeContent } : m));
      }
      return prev;
    });
  }, [agentName]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oauthPopupRef = useRef<Window | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Derive per-agent integration status from provider
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const agentGoogleEnabled = selectedAgent?.integrations.google ?? false;
  const agentSlackEnabled = selectedAgent?.integrations.slack ?? false;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  const connectGoogleForAgent = useCallback(() => {
    if (!selectedAgentId) return;

    // Open OAuth popup with agentId — the callback will auto-enable Google on this agent
    oauthPopupRef.current = window.open(
      `/api/integrations/google?agentId=${selectedAgentId}`,
      "connect-google",
      "width=600,height=700,left=200,top=100"
    );

    // Poll until popup closes, then refresh to pick up new state
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = setInterval(async () => {
      if (oauthPopupRef.current?.closed) {
        clearInterval(pollTimerRef.current!);
        pollTimerRef.current = null;
        await refresh();
      }
    }, 1000);
  }, [selectedAgentId, refresh]);

  const openOAuthPopup = useCallback(
    (provider: "slack") => {
      const url = "/api/integrations/slack";

      oauthPopupRef.current = window.open(
        url,
        `connect-${provider}`,
        "width=600,height=700,left=200,top=100"
      );

      // Poll for connection every 2s
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        await refresh();
      }, 2000);
    },
    [refresh]
  );

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognitionClass) return;
      recognitionRef.current = new SpeechRecognitionClass();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Gate: loading (initial fetch or re-check in progress)
  if (hasRunningAgent === null || !statusChecked) {
    return (
      <div className="flex items-center justify-center h-[calc(100dvh-2rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-aura-accent" />
      </div>
    );
  }

  // Gate: no agents at all
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100dvh-2rem)] max-w-md mx-auto text-center gap-6">
        <div className="w-16 h-16 rounded-full bg-aura-accent/10 flex items-center justify-center">
          <Rocket className="w-8 h-8 text-aura-accent" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-aura-text-white">
            Deploy an agent to start chatting
          </h1>
          <p className="text-aura-text-dim">
            Create and deploy your AI agent first, then come back here to chat.
          </p>
        </div>
        <Button asChild className="bg-aura-accent hover:bg-aura-accent-bright">
          <NextLink href="/agents">
            <Bot className="mr-2 h-4 w-4" />
            Go to Agents
          </NextLink>
        </Button>
      </div>
    );
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const speakMessage = (text: string) => {
    if ("speechSynthesis" in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsLoading(true);
    setToolStatus(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          ...(selectedAgentId ? { agentId: selectedAgentId } : {}),
        }),
      });

      // Pre-stream errors come back as JSON
      if (!response.ok) {
        let errorText = "Something went wrong. Please try again.";
        try {
          const errData = await response.json();
          errorText = errData.error || errorText;
        } catch { /* ignore */ }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: errorText } : m))
        );
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: "Failed to read response." } : m
          )
        );
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();

          if (payload === "[DONE]") continue;

          try {
            const event = JSON.parse(payload);

            if (event.content) {
              accumulated += event.content;
              const newContent = accumulated;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: newContent } : m
                )
              );
            }

            if (event.status) {
              setToolStatus(event.status);
            }

            if (event.error) {
              accumulated += event.error;
              const newContent = accumulated;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: newContent } : m
                )
              );
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }

      // If no content arrived, show fallback
      if (!accumulated) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "I'm sorry, I couldn't process that request." }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, I encountered an error. Please try again." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setToolStatus(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const email = user?.email?.address ?? "User";
  const initials = email.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-[calc(100dvh-2rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 p-3 sm:p-4 border-b border-aura-border">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aura-accent to-aura-purple flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          {agents.length >= 2 && selectedAgentId ? (
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="border-none shadow-none bg-transparent px-0 h-auto text-aura-text-white font-semibold text-base gap-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-aura-surface border-aura-border">
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-aura-text-light">
                    <span className="flex items-center gap-2">
                      {a.running && (
                        <span className="w-2 h-2 rounded-full bg-aura-mint flex-shrink-0" />
                      )}
                      <span className={a.running ? "" : "text-aura-text-dim"}>{a.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <h1 className="font-semibold text-aura-text-white">{agentName ?? "Agent"}</h1>
          )}
          <p className="text-sm text-aura-text-dim">Your AI Agent</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          {agentGoogleEnabled && (
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-aura-accent/10 text-aura-accent text-xs font-medium">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="hidden sm:inline">Gmail & Calendar</span>
            </div>
          )}
          {agentSlackEnabled && (
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-aura-purple/10 text-aura-purple text-xs font-medium">
              <Hash className="w-3 h-3 flex-shrink-0" />
              <span className="hidden sm:inline">Slack</span>
            </div>
          )}
          {agents.find((a) => a.id === selectedAgentId)?.running && (
            <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-aura-mint/10 text-aura-mint text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-aura-mint animate-pulse flex-shrink-0" />
              <span className="hidden sm:inline">Agent Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.filter((m) => m.role === "user" || m.content).map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex items-start gap-3",
              message.role === "user" ? "flex-row-reverse" : ""
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                message.role === "user"
                  ? "bg-aura-accent/20 text-aura-accent"
                  : "bg-gradient-to-br from-aura-accent to-aura-purple text-white"
              )}
            >
              {message.role === "user" ? (
                <span className="text-xs font-medium">{initials}</span>
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
            </div>
            <div
              className={cn(
                "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3",
                message.role === "user"
                  ? "bg-aura-accent text-white rounded-tr-sm"
                  : "bg-aura-surface border border-aura-border text-aura-text-light rounded-tl-sm"
              )}
            >
              <div className="whitespace-pre-wrap prose prose-invert prose-sm max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-hr:my-2">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 mt-2 text-xs",
                  message.role === "user" ? "text-white/60 justify-end" : "text-aura-text-ghost"
                )}
              >
                <span>
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {message.role === "assistant" && (
                  <button
                    onClick={() => speakMessage(message.content)}
                    className="hover:text-aura-accent transition-colors"
                    title="Read aloud"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && !messages[messages.length - 1]?.content && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-aura-accent to-aura-purple flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-aura-surface border border-aura-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-aura-text-dim">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{toolStatus || "Thinking..."}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-3 sm:p-4 border-t border-aura-border pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {/* Tool connection buttons */}
        <div className="flex items-center gap-2 mb-2 sm:mb-3 flex-nowrap overflow-x-auto scrollbar-none">
          {!agentGoogleEnabled && (
            <button
              type="button"
              onClick={connectGoogleForAgent}
              className="flex items-center gap-1.5 rounded-full border border-aura-border px-3.5 py-1.5 text-xs font-medium text-aura-text-light hover:border-aura-accent hover:text-aura-accent transition-colors whitespace-nowrap flex-shrink-0"
            >
              <Mail className="w-3.5 h-3.5" />
              Connect Gmail
            </button>
          )}
          {!agentSlackEnabled && (
            <button
              type="button"
              onClick={() => openOAuthPopup("slack")}
              className="flex items-center gap-1.5 rounded-full border border-aura-border px-3.5 py-1.5 text-xs font-medium text-aura-text-light hover:border-aura-accent hover:text-aura-accent transition-colors whitespace-nowrap flex-shrink-0"
            >
              <Hash className="w-3.5 h-3.5" />
              Connect Slack
            </button>
          )}
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-aura-border px-3.5 py-1.5 text-xs font-medium text-aura-text-light hover:border-aura-accent hover:text-aura-accent transition-colors whitespace-nowrap flex-shrink-0"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Connect Telegram
          </button>
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full border border-dashed border-aura-border px-3.5 py-1.5 text-xs font-medium text-aura-text-dim hover:border-aura-accent hover:text-aura-accent transition-colors whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect More
              </button>
            </DialogTrigger>
            <DialogContent className="bg-aura-surface border-aura-border max-w-lg max-h-[70vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-aura-text-white">Connect an Integration</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                {(Object.keys(categoryMeta) as IntegrationCategory[]).map((cat) => {
                  const providers = integrationProviders.filter((p) => p.category === cat);
                  if (!providers.length) return null;
                  return (
                    <div key={cat}>
                      <p className="text-xs font-medium text-aura-text-dim mb-2">
                        {categoryMeta[cat].label}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {providers.map((p) => {
                          const Icon = p.icon;
                          return (
                            <NextLink
                              key={p.id}
                              href="/integrations"
                              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-aura-text-light hover:bg-aura-accent/10 hover:text-aura-accent transition-colors"
                            >
                              <Icon className="w-4 h-4 flex-shrink-0" />
                              <span className="truncate">{p.name}</span>
                              {p.comingSoon && (
                                <span className="text-[10px] text-aura-text-ghost ml-auto">Soon</span>
                              )}
                            </NextLink>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="w-full resize-none rounded-xl border border-aura-border bg-aura-surface pl-4 pr-11 py-3 text-base text-aura-text-white placeholder:text-aura-text-ghost focus:border-aura-accent focus:outline-none focus:ring-1 focus:ring-aura-accent"
              rows={1}
              style={{
                minHeight: "44px",
                maxHeight: "200px",
              }}
            />
            <button
              type="button"
              onClick={toggleListening}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 rounded-lg transition-colors",
                isListening
                  ? "text-red-500 bg-red-500/10"
                  : "text-aura-text-dim hover:text-aura-text-light"
              )}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="h-[44px] w-[44px] rounded-xl bg-aura-accent hover:bg-aura-accent-bright flex-shrink-0"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <p className="hidden sm:block text-xs text-aura-text-ghost mt-2 text-center">
          {isListening ? (
            <span className="text-red-400">🎤 Listening... Click mic to stop</span>
          ) : isSpeaking ? (
            <span className="text-aura-accent">🔊 Speaking...</span>
          ) : (
            "Press Enter to send • Click mic for voice input"
          )}
        </p>
      </div>
    </div>
  );
}
