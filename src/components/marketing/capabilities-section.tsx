"use client";

import { useState } from "react";

const capabilities = [
  {
    id: "voice",
    icon: "🎙️",
    iconBg: "bg-aura-accent/10",
    title: "Voice-First Interface",
    description:
      "Speak naturally and Aura executes. Schedule calls, draft emails, update your pipeline, pull research — all through conversation. No dashboards. No forms. Just talk.",
    example: {
      prefix: '"Aura,',
      text: ' reschedule tomorrow\'s standup to 3pm and let the team know."',
    },
    demo: (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-aura-accent/20">
            <svg className="h-5 w-5 text-aura-accent animate-pulse" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="h-2 rounded-full bg-aura-accent/30" style={{ width: "60%" }} />
          </div>
        </div>
        <p className="text-xs text-aura-text-dim">Listening...</p>
      </div>
    ),
  },
  {
    id: "context",
    icon: "🧠",
    iconBg: "bg-aura-mint/10",
    title: "Persistent Context",
    description:
      'Aura remembers your projects, your team, your priorities. Ask "where did we leave off with Meridian?" and get an instant brief — not a blank stare.',
    example: {
      prefix: '"Aura,',
      text: " what did I commit to in last Friday's partner call?\"",
    },
    demo: (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-aura-text-dim">
          <span className="text-aura-mint">✓</span> Meridian Project
        </div>
        <div className="flex items-center gap-2 text-xs text-aura-text-dim">
          <span className="text-aura-mint">✓</span> Team Members: 5
        </div>
        <div className="flex items-center gap-2 text-xs text-aura-text-dim">
          <span className="text-aura-mint">✓</span> Last Meeting: 3 days ago
        </div>
      </div>
    ),
  },
  {
    id: "execution",
    icon: "⚡",
    iconBg: "bg-aura-amber/10",
    title: "Real-Time Execution",
    description:
      "Aura doesn't just suggest — it does. Sends the email. Books the room. Updates the tracker. Flags the risk. You stay in flow while Aura handles the overhead.",
    example: {
      prefix: '"Aura,',
      text: ' send the proposal to Sarah with the updated pricing deck attached."',
    },
    demo: (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-aura-mint">✓</span>
          <span className="text-aura-text-light">Email sent</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-aura-mint">✓</span>
          <span className="text-aura-text-light">Attachment added</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-aura-mint">✓</span>
          <span className="text-aura-text-light">CRM updated</span>
        </div>
      </div>
    ),
  },
  {
    id: "trust",
    icon: "🔐",
    iconBg: "bg-aura-purple/10",
    title: "Built on Trust",
    description:
      "Every output is verifiable. Aura runs on cryptographic infrastructure that ensures accountability at every step. Not just smart — provably trustworthy.",
    example: {
      prefix: '"Aura,',
      text: ' show me the audit trail for the deliverable we sent Monday."',
    },
    demo: (
      <div className="space-y-2">
        <div className="rounded border border-aura-border bg-aura-void/50 px-2 py-1 text-[10px] font-mono text-aura-text-ghost">
          tx: 0x8f2a...c4d1
        </div>
        <div className="text-xs text-aura-mint">Verified ✓</div>
      </div>
    ),
  },
];

export function CapabilitiesSection() {
  const [activeTab, setActiveTab] = useState(capabilities[0].id);
  const activeCap = capabilities.find((c) => c.id === activeTab) || capabilities[0];

  return (
    <section id="what" className="mx-auto max-w-[1160px] px-12 pb-[120px] pt-[100px] max-[960px]:px-6">
      <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
        Capabilities
      </div>
      <h2 className="mb-[18px] text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px] text-aura-text-white">
        One AI that
        <br />
        <span className="gradient-text">runs everything.</span>
      </h2>
      <p className="mb-[72px] max-w-[480px] text-[16.5px] leading-[1.75] text-aura-text-light">
        Aura isn&apos;t a chatbot. It&apos;s an operations layer — connecting
        your calendar, comms, pipeline, and projects into one intelligence that
        learns how you work.
      </p>

      {/* Tabbed interface for desktop */}
      <div className="hidden lg:block">
        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-aura-border pb-4">
          {capabilities.map((cap) => (
            <button
              key={cap.id}
              onClick={() => setActiveTab(cap.id)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                activeTab === cap.id
                  ? "bg-aura-accent text-white"
                  : "text-aura-text-dim hover:text-aura-text-light hover:bg-aura-surface"
              }`}
            >
              <span>{cap.icon}</span>
              <span>{cap.title}</span>
            </button>
          ))}
        </div>

        {/* Active tab content */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="mb-4 text-2xl font-bold text-aura-text-white">{activeCap.title}</h3>
            <p className="mb-6 text-aura-text-light leading-relaxed">{activeCap.description}</p>
            <div className="rounded-lg border-l-2 border-aura-accent bg-aura-surface px-4 py-3 font-mono text-[12.5px] leading-[1.6] text-aura-text-dim">
              <span className="text-aura-accent">{activeCap.example.prefix}</span>
              {activeCap.example.text}
            </div>
          </div>
          <div className="flex items-center justify-center rounded-2xl border border-aura-border bg-aura-surface p-8">
            {activeCap.demo}
          </div>
        </div>
      </div>

      {/* Cards grid for mobile/tablet */}
      <div className="grid grid-cols-2 gap-[18px] max-[960px]:grid-cols-1 lg:hidden">
        {capabilities.map((cap) => (
          <div
            key={cap.title}
            className="group relative overflow-hidden rounded-2xl border border-aura-border bg-aura-surface px-8 py-10 transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-1 hover:border-aura-border-hover card-hover"
          >
            {/* Top accent line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aura-accent to-transparent opacity-0 transition-opacity duration-[350ms] group-hover:opacity-100" />
            <div
              className={`mb-[22px] grid h-[50px] w-[50px] place-items-center rounded-[13px] text-[23px] ${cap.iconBg}`}
            >
              {cap.icon}
            </div>
            <h3 className="mb-[10px] text-lg font-bold tracking-[-0.4px] text-aura-text-white">
              {cap.title}
            </h3>
            <p className="text-[14.5px] leading-[1.7] text-aura-text-light">
              {cap.description}
            </p>
            <div className="mt-[18px] rounded-lg border-l-2 border-aura-accent bg-aura-void/50 px-4 py-3 font-mono text-[12.5px] leading-[1.6] text-aura-text-dim">
              <span className="text-aura-accent">{cap.example.prefix}</span>
              {cap.example.text}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
