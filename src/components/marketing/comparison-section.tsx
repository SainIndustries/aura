"use client";

const features = [
  {
    category: "Knowledge",
    chatbot: "Knows what you tell it in the moment",
    aura: "Knows your projects, team, and priorities persistently",
  },
  {
    category: "Execution",
    chatbot: "Suggests actions for you to take",
    aura: "Executes actions directly (emails, calendar, CRM)",
  },
  {
    category: "Integration",
    chatbot: "Lives in its own tab or window",
    aura: "Lives where you already work (Slack, email, voice)",
  },
  {
    category: "Context",
    chatbot: "Forgets everything after each session",
    aura: "Builds understanding over time, never forgets",
  },
  {
    category: "Proactivity",
    chatbot: "Only responds when prompted",
    aura: "Proactively alerts you to what matters",
  },
  {
    category: "Trust",
    chatbot: "Black box outputs, no audit trail",
    aura: "Every action logged, traceable, and verifiable",
  },
];

export function ComparisonSection() {
  return (
    <section className="mx-auto max-w-[1160px] px-12 py-[100px] max-[960px]:px-6">
      <div className="mb-[14px] text-center text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
        The Difference
      </div>
      <h2 className="mb-5 text-center text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px] text-aura-text-white">
        Not another chatbot.
        <br />
        <span className="gradient-text">An AI employee.</span>
      </h2>
      <p className="mx-auto mb-12 max-w-[520px] text-center text-[16.5px] leading-[1.75] text-aura-text-light">
        Most AI assistants are fancy search bars. Aura is the first AI that 
        actually works alongside you — with real context and real execution power.
      </p>

      {/* Comparison table */}
      <div className="overflow-hidden rounded-2xl border border-aura-border">
        {/* Header */}
        <div className="grid grid-cols-3 border-b border-aura-border bg-aura-void/50">
          <div className="p-4 text-sm font-medium text-aura-text-dim">Feature</div>
          <div className="border-l border-aura-border p-4 text-center">
            <div className="mb-1 text-sm font-bold text-aura-text-ghost">Regular AI Chatbot</div>
            <div className="text-xs text-aura-text-ghost">ChatGPT, Gemini, etc.</div>
          </div>
          <div className="border-l border-aura-border bg-aura-accent/5 p-4 text-center">
            <div className="mb-1 text-sm font-bold text-aura-accent">Aura AI Employee</div>
            <div className="text-xs text-aura-text-dim">Built for operators</div>
          </div>
        </div>

        {/* Rows */}
        {features.map((feature, index) => (
          <div
            key={feature.category}
            className={`grid grid-cols-3 ${
              index < features.length - 1 ? "border-b border-aura-border" : ""
            }`}
          >
            <div className="flex items-center p-4">
              <span className="text-sm font-medium text-aura-text-white">{feature.category}</span>
            </div>
            <div className="flex items-center border-l border-aura-border bg-red-500/[0.02] p-4">
              <div className="flex items-start gap-2 text-sm text-aura-text-dim">
                <span className="mt-0.5 shrink-0 text-red-400/60">✗</span>
                <span>{feature.chatbot}</span>
              </div>
            </div>
            <div className="flex items-center border-l border-aura-border bg-aura-accent/5 p-4">
              <div className="flex items-start gap-2 text-sm text-aura-text-light">
                <span className="mt-0.5 shrink-0 text-aura-mint">✓</span>
                <span>{feature.aura}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom visual */}
      <div className="mt-10 grid grid-cols-2 gap-6 max-[768px]:grid-cols-1">
        {/* Chatbot illustration */}
        <div className="rounded-2xl border border-aura-border bg-aura-surface p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-gray-500/10 p-2">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-aura-text-ghost">AI Chatbot</span>
          </div>
          <div className="space-y-2">
            <div className="rounded-lg bg-aura-void/50 p-3">
              <p className="text-xs text-aura-text-ghost">&quot;How do I schedule a meeting?&quot;</p>
            </div>
            <div className="rounded-lg bg-aura-void/50 p-3">
              <p className="text-xs text-aura-text-ghost">&quot;Here are 5 steps to schedule a meeting...&quot;</p>
            </div>
            <div className="flex items-center gap-2 pt-2 text-xs text-red-400/80">
              <span>→</span>
              <span>You still do all the work</span>
            </div>
          </div>
        </div>

        {/* Aura illustration */}
        <div className="rounded-2xl border border-aura-accent/20 bg-aura-accent/5 p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-aura-accent to-aura-purple p-2">
              <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-sm font-medium text-aura-accent">Aura</span>
          </div>
          <div className="space-y-2">
            <div className="rounded-lg bg-aura-surface/50 p-3">
              <p className="text-xs text-aura-text-light">&quot;Schedule a call with Marcus Thursday&quot;</p>
            </div>
            <div className="rounded-lg bg-aura-surface/50 p-3">
              <p className="text-xs text-aura-mint">✓ Calendar invite sent — Thu 10:30 AM</p>
            </div>
            <div className="flex items-center gap-2 pt-2 text-xs text-aura-mint">
              <span>→</span>
              <span>Aura does the work for you</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
