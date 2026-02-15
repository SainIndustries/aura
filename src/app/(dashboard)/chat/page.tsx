"use client";

import { useState, useRef, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  Send,
  Mic,
  MicOff,
  Volume2,
  Bot,
  Loader2,
  Sparkles,
  Mail,
  Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hey! I'm Aura, your AI assistant. How can I help you today? You can type or use voice to talk to me.",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [googleConnected, setGoogleConnected] = useState<boolean | null>(null);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [openclawRunning, setOpenclawRunning] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check Google integration status
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch("/api/integrations/status");
        if (res.ok) {
          const data = await res.json();
          setGoogleConnected(data.google?.connected ?? false);
          setGoogleEmail(data.google?.email ?? null);
          setOpenclawRunning(data.openclaw?.running ?? false);
        }
      } catch {
        // Silently fail — not critical
      }
    }
    checkStatus();
  }, []);

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

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || "I'm sorry, I couldn't process that request.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
    <div className="flex flex-col h-[calc(100vh-2rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-aura-border">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-aura-accent to-aura-purple flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-semibold text-aura-text-white">Aura</h1>
          <p className="text-sm text-aura-text-dim">Your AI Assistant</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {googleConnected && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-aura-accent/10 text-aura-accent text-xs font-medium">
              <Mail className="w-3 h-3" />
              Gmail & Calendar
            </div>
          )}
          {openclawRunning ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-aura-mint/10 text-aura-mint text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-aura-mint animate-pulse" />
              Agent Live
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-aura-mint/10 text-aura-mint text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-aura-mint animate-pulse" />
              Online
            </div>
          )}
        </div>
      </div>

      {/* Status banners */}
      {openclawRunning === false && (
        <a
          href="/agents"
          className="flex items-center gap-2 px-4 py-2.5 bg-aura-surface border-b border-aura-border text-sm text-aura-text-dim hover:text-aura-text-light transition-colors"
        >
          <Link className="w-4 h-4 text-aura-accent" />
          <span>
            <span className="text-aura-text-light font-medium">Deploy an agent</span> to unlock full Aura capabilities with your own OpenClaw instance
          </span>
        </a>
      )}
      {openclawRunning && googleConnected === false && (
        <a
          href="/integrations"
          className="flex items-center gap-2 px-4 py-2.5 bg-aura-surface border-b border-aura-border text-sm text-aura-text-dim hover:text-aura-text-light transition-colors"
        >
          <Link className="w-4 h-4 text-aura-accent" />
          <span>
            <span className="text-aura-text-light font-medium">Connect Google</span> to manage emails & calendar directly from chat
          </span>
        </a>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
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
                "max-w-[75%] rounded-2xl px-4 py-3",
                message.role === "user"
                  ? "bg-aura-accent text-white rounded-tr-sm"
                  : "bg-aura-surface border border-aura-border text-aura-text-light rounded-tl-sm"
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
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

        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-aura-accent to-aura-purple flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="bg-aura-surface border border-aura-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-2 text-aura-text-dim">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-aura-border">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message or click the mic to speak..."
              className="w-full resize-none rounded-xl border border-aura-border bg-aura-surface px-4 py-3 pr-12 text-aura-text-white placeholder:text-aura-text-ghost focus:border-aura-accent focus:outline-none focus:ring-1 focus:ring-aura-accent"
              rows={1}
              style={{
                minHeight: "48px",
                maxHeight: "200px",
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleListening}
              className={cn(
                "absolute right-2 bottom-2 h-8 w-8",
                isListening
                  ? "text-red-500 hover:text-red-400 bg-red-500/10"
                  : "text-aura-text-dim hover:text-aura-text-light"
              )}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </Button>
          </div>
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="h-12 w-12 rounded-xl bg-aura-accent hover:bg-aura-accent-bright"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-aura-text-ghost mt-2 text-center">
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
