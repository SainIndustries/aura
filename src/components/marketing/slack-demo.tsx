"use client";

import { useState, useEffect } from "react";

interface Message {
  id: number;
  sender: "user" | "aura";
  avatar?: string;
  name: string;
  time: string;
  content: string | React.ReactNode;
  isAction?: boolean;
}

const scenarios = {
  scheduling: {
    title: "Smart Scheduling",
    messages: [
      {
        id: 1,
        sender: "user" as const,
        name: "Sarah Chen",
        time: "9:32 AM",
        content: "@Aura set up a call with Marcus for Thursday to discuss the pilot program",
      },
      {
        id: 2,
        sender: "aura" as const,
        name: "Aura",
        time: "9:32 AM",
        content: (
          <div className="space-y-2">
            <p>I&apos;ll coordinate with Marcus. Checking both calendars...</p>
            <div className="rounded-lg border border-aura-border bg-aura-void/50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-aura-text-white">
                <span className="text-aura-mint">✓</span>
                <span>Found mutual availability</span>
              </div>
              <div className="mt-2 text-sm text-aura-text-light">
                <strong>Thursday, Feb 20</strong> at 10:30 AM ET
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 3,
        sender: "aura" as const,
        name: "Aura",
        time: "9:33 AM",
        isAction: true,
        content: (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-aura-mint">📅</span>
            <span className="text-aura-text-light">Sent calendar invite to <strong>Marcus Chen</strong> — Thu 2/20, 10:30 AM ET</span>
          </div>
        ),
      },
    ],
  },
  pipeline: {
    title: "Pipeline Intelligence",
    messages: [
      {
        id: 1,
        sender: "user" as const,
        name: "Sarah Chen",
        time: "2:15 PM",
        content: "@Aura what's the status on our sales pipeline? Any deals I should follow up on?",
      },
      {
        id: 2,
        sender: "aura" as const,
        name: "Aura",
        time: "2:15 PM",
        content: (
          <div className="space-y-3">
            <p>Analyzing your pipeline activity...</p>
            <div className="space-y-2">
              <div className="rounded-lg border border-aura-border bg-aura-void/50 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-aura-text-white">Active Deals</span>
                  <span className="text-aura-accent font-bold">3 in play</span>
                </div>
              </div>
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
                  <span>⚠️</span>
                  <span>Attention Needed</span>
                </div>
                <p className="mt-1 text-sm text-aura-text-light">
                  <strong>Meridian Contract</strong> — Last touch was 9 days ago. Risk of going cold.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 3,
        sender: "aura" as const,
        name: "Aura",
        time: "2:16 PM",
        content: "I can draft a check-in email to Meridian. Want me to pull context from your last conversation?",
      },
    ],
  },
  research: {
    title: "Deep Research",
    messages: [
      {
        id: 1,
        sender: "user" as const,
        name: "Sarah Chen",
        time: "11:45 AM",
        content: "@Aura I need a competitive analysis of enterprise AI assistants for my board deck",
      },
      {
        id: 2,
        sender: "aura" as const,
        name: "Aura",
        time: "11:45 AM",
        content: (
          <div className="space-y-2">
            <p>Starting research on enterprise AI assistants...</p>
            <div className="rounded-lg border border-aura-border bg-aura-void/50 p-3">
              <div className="flex items-center gap-2 text-sm">
                <div className="h-2 w-2 rounded-full bg-aura-accent animate-pulse" />
                <span className="text-aura-text-light">Analyzing 12 competitors across 6 dimensions</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 3,
        sender: "aura" as const,
        name: "Aura",
        time: "11:52 AM",
        isAction: true,
        content: (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-aura-mint">📊</span>
              <span className="text-aura-text-light">Research complete — <strong>14-page analysis</strong> ready</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button className="rounded-md bg-aura-accent/10 px-3 py-1.5 text-xs font-medium text-aura-accent hover:bg-aura-accent/20 transition-colors">
                View Report
              </button>
              <button className="rounded-md bg-aura-surface border border-aura-border px-3 py-1.5 text-xs font-medium text-aura-text-light hover:bg-aura-elevated transition-colors">
                Add to Deck
              </button>
            </div>
          </div>
        ),
      },
    ],
  },
};

export function SlackDemo() {
  const [activeTab, setActiveTab] = useState<keyof typeof scenarios>("scheduling");
  const [visibleMessages, setVisibleMessages] = useState<number[]>([]);

  useEffect(() => {
    setVisibleMessages([]);
    const messages = scenarios[activeTab].messages;
    messages.forEach((msg, index) => {
      setTimeout(() => {
        setVisibleMessages((prev) => [...prev, msg.id]);
      }, (index + 1) * 800);
    });
  }, [activeTab]);

  return (
    <section id="demo" className="relative z-[5] flex justify-center px-6 pb-[100px] pt-5">
      <div className="w-full max-w-[720px]">
        {/* Section header */}
        <div className="mb-8 text-center">
          <div className="mb-3 text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
            See It In Action
          </div>
          <h2 className="text-2xl font-bold tracking-[-0.5px] text-aura-text-white">
            AI that works where you work
          </h2>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex justify-center gap-2">
          {Object.entries(scenarios).map(([key, scenario]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as keyof typeof scenarios)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeTab === key
                  ? "bg-aura-accent text-white"
                  : "bg-aura-surface border border-aura-border text-aura-text-dim hover:text-aura-text-light hover:border-aura-border-hover"
              }`}
            >
              {scenario.title}
            </button>
          ))}
        </div>

        {/* Slack-style window */}
        <div className="animate-fade-slide-up overflow-hidden rounded-[14px] border border-aura-border bg-aura-surface shadow-[0_32px_80px_rgba(0,0,0,0.15)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.025)_inset,0_0_120px_-40px_rgba(79,143,255,0.12)]">
          {/* Window header */}
          <div className="flex items-center gap-3 border-b border-aura-border bg-aura-void/50 px-4 py-3">
            <div className="flex gap-[7px]">
              <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
              <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
              <span className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">#</span>
              <span className="text-sm font-medium text-aura-text-white">team-general</span>
            </div>
          </div>

          {/* Messages area */}
          <div className="min-h-[320px] px-4 py-4 space-y-4">
            {scenarios[activeTab].messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 transition-all duration-500 ${
                  visibleMessages.includes(msg.id)
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                }`}
              >
                {/* Avatar */}
                <div
                  className={`h-9 w-9 shrink-0 rounded-lg ${
                    msg.sender === "aura"
                      ? "bg-gradient-to-br from-aura-accent to-aura-purple grid place-items-center"
                      : "bg-gradient-to-br from-emerald-400 to-teal-500 grid place-items-center"
                  }`}
                >
                  {msg.sender === "aura" ? (
                    <svg
                      className="h-[18px] w-[18px] text-white"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  ) : (
                    <span className="text-sm font-bold text-white">SC</span>
                  )}
                </div>

                {/* Message content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold text-sm text-aura-text-white">{msg.name}</span>
                    {msg.sender === "aura" && (
                      <span className="rounded bg-aura-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-aura-accent">
                        AI
                      </span>
                    )}
                    <span className="text-xs text-aura-text-ghost">{msg.time}</span>
                  </div>
                  <div className={`mt-1 text-sm leading-relaxed ${"isAction" in msg && msg.isAction ? "" : "text-aura-text-light"}`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {visibleMessages.length < scenarios[activeTab].messages.length && (
              <div className="flex items-center gap-2 text-aura-text-ghost text-xs">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-aura-text-ghost/50 animate-typing-dot" />
                  <span className="h-2 w-2 rounded-full bg-aura-text-ghost/50 animate-typing-dot" />
                  <span className="h-2 w-2 rounded-full bg-aura-text-ghost/50 animate-typing-dot" />
                </div>
                <span>Aura is typing...</span>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="border-t border-aura-border px-4 py-3">
            <div className="flex items-center gap-2 rounded-lg border border-aura-border bg-aura-void/50 px-3 py-2">
              <span className="text-aura-text-ghost">💬</span>
              <span className="text-sm text-aura-text-ghost">Message #team-general</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
