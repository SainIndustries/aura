"use client";

import { useState } from "react";

const roles = [
  {
    id: "founder",
    title: "Founder / CEO",
    icon: "🚀",
    before: {
      title: "Without Aura",
      items: [
        "Check Slack → Email → Calendar → CRM every hour",
        "Manually track follow-ups in a spreadsheet",
        "Spend 2+ hours scheduling meetings",
        "Miss important signals buried in threads",
        "Context switch 50+ times per day",
      ],
    },
    after: {
      title: "With Aura",
      items: [
        "\"@Aura, what needs my attention right now?\"",
        "Aura auto-surfaces deals going quiet",
        "\"@Aura, find 30min with the board next week\"",
        "Proactive alerts on critical signals",
        "One conversation, zero context switching",
      ],
    },
  },
  {
    id: "sales",
    title: "Sales / BD Lead",
    icon: "🎯",
    before: {
      title: "Without Aura",
      items: [
        "Manually update CRM after every call",
        "Forget to follow up on warm leads",
        "Dig through emails to find context",
        "Miss buying signals in conversations",
        "Spend 40% of time on admin work",
      ],
    },
    after: {
      title: "With Aura",
      items: [
        "Aura logs calls and updates CRM automatically",
        "\"Hey, Acme hasn't responded in 7 days\"",
        "\"@Aura, brief me on the Meridian deal\"",
        "AI highlights urgency and intent signals",
        "Focus 100% on closing deals",
      ],
    },
  },
  {
    id: "ops",
    title: "Operations Lead",
    icon: "🏗️",
    before: {
      title: "Without Aura",
      items: [
        "Jump between 12 tools to find status",
        "Chase people for updates via Slack",
        "Manually create weekly reports",
        "Miss deadlines buried in threads",
        "Repeat answers to the same questions",
      ],
    },
    after: {
      title: "With Aura",
      items: [
        "\"@Aura, status on Q2 initiatives\"",
        "Automatic status collection from tools",
        "\"@Aura, generate the weekly report\"",
        "Proactive deadline reminders",
        "Aura answers team FAQs with context",
      ],
    },
  },
];

export function SolutionSection() {
  const [activeRole, setActiveRole] = useState(roles[0].id);
  const currentRole = roles.find((r) => r.id === activeRole) || roles[0];

  return (
    <section id="solution" className="mx-auto max-w-[1160px] px-12 py-[100px] max-[960px]:px-6">
      <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
        The Solution
      </div>
      <h2 className="mb-5 text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px] text-aura-text-white">
        One AI that runs
        <br />
        <span className="gradient-text">everything.</span>
      </h2>
      <p className="mb-12 max-w-[520px] text-[16.5px] leading-[1.75] text-aura-text-light">
        Aura isn&apos;t another app to manage. It&apos;s an intelligence layer that 
        connects your tools and handles the work you shouldn&apos;t be doing.
      </p>

      {/* Role selector */}
      <div className="mb-8 flex flex-wrap gap-3">
        {roles.map((role) => (
          <button
            key={role.id}
            onClick={() => setActiveRole(role.id)}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all ${
              activeRole === role.id
                ? "bg-aura-accent text-white shadow-glow"
                : "bg-aura-surface border border-aura-border text-aura-text-dim hover:text-aura-text-light hover:border-aura-border-hover"
            }`}
          >
            <span>{role.icon}</span>
            <span>{role.title}</span>
          </button>
        ))}
      </div>

      {/* Before/After comparison */}
      <div className="grid grid-cols-2 gap-6 max-[768px]:grid-cols-1">
        {/* Before */}
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-400" />
            <span className="text-sm font-bold text-red-400">{currentRole.before.title}</span>
          </div>
          <ul className="space-y-3">
            {currentRole.before.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-aura-text-light">
                <span className="mt-0.5 text-red-400/60">✗</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* After */}
        <div className="rounded-2xl border border-aura-mint/20 bg-aura-mint/5 p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-aura-mint" />
            <span className="text-sm font-bold text-aura-mint">{currentRole.after.title}</span>
          </div>
          <ul className="space-y-3">
            {currentRole.after.items.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-aura-text-light">
                <span className="mt-0.5 text-aura-mint">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Time saved callout */}
      <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-2xl border border-aura-border bg-aura-surface p-8 text-center md:flex-row md:gap-8">
        <div className="flex items-center gap-3">
          <div className="text-4xl font-extrabold text-aura-accent">10+</div>
          <div className="text-left text-sm text-aura-text-light">
            hours saved<br />per week
          </div>
        </div>
        <div className="hidden h-12 w-px bg-aura-border md:block" />
        <div className="flex items-center gap-3">
          <div className="text-4xl font-extrabold text-aura-purple">50%</div>
          <div className="text-left text-sm text-aura-text-light">
            fewer tool<br />switches
          </div>
        </div>
        <div className="hidden h-12 w-px bg-aura-border md:block" />
        <div className="flex items-center gap-3">
          <div className="text-4xl font-extrabold text-aura-mint">Zero</div>
          <div className="text-left text-sm text-aura-text-light">
            dropped<br />follow-ups
          </div>
        </div>
      </div>
    </section>
  );
}
