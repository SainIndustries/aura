const steps = [
  {
    num: 1,
    icon: "🔌",
    title: "Connect Your Tools",
    description:
      "Calendar, email, Slack, your CRM — Aura plugs into where you already work. No migration. No learning curve.",
    details: ["2-minute setup", "50+ integrations", "Works with existing workflows"],
  },
  {
    num: 2,
    icon: "💬",
    title: "Talk to Aura",
    description:
      "Voice or text — tell Aura what you need. It learns your patterns, your team, your priorities with every interaction.",
    details: ["Natural language", "Persistent memory", "Context-aware"],
  },
  {
    num: 3,
    icon: "✨",
    title: "Watch It Run",
    description:
      "Aura executes in real-time. Meetings booked. Emails drafted. Pipelines updated. You just operate.",
    details: ["Real-time execution", "Full audit trail", "Zero manual work"],
  },
];

export function HowItWorksSection() {
  return (
    <section id="how" className="mx-auto max-w-[1160px] px-12 pb-[120px] pt-[100px] max-[960px]:px-6">
      <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
        How It Works
      </div>
      <h2 className="mb-[18px] text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px] text-aura-text-white">
        Three steps to
        <br />
        <span className="gradient-text">
          more.
        </span>
      </h2>
      <p className="mb-[72px] max-w-[480px] text-[16.5px] leading-[1.75] text-aura-text-light">
        Getting started with Aura takes less time than scheduling a meeting the
        old way.
      </p>
      <div className="relative grid grid-cols-3 gap-[18px] max-[960px]:grid-cols-1">
        {/* Connecting line */}
        <div className="absolute left-[16.6%] right-[16.6%] top-[60px] h-px bg-gradient-to-r from-transparent via-aura-accent/20 to-transparent max-[960px]:hidden" />

        {steps.map((step) => (
          <div key={step.num} className="group relative z-[1]">
            <div className="rounded-2xl border border-aura-border bg-aura-surface p-6 transition-all duration-300 hover:border-aura-border-hover card-hover">
              {/* Step number */}
              <div className="mb-5 inline-grid h-14 w-14 place-items-center rounded-full border-2 border-aura-accent bg-aura-void text-xl font-bold text-aura-accent shadow-[0_0_24px_rgba(79,143,255,0.12)]">
                {step.icon}
              </div>

              {/* Step indicator */}
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-aura-accent/10 text-xs font-bold text-aura-accent">
                  {step.num}
                </span>
                <span className="text-xs font-medium text-aura-text-ghost">Step {step.num}</span>
              </div>

              <h3 className="mb-3 text-lg font-bold tracking-[-0.3px] text-aura-text-white">
                {step.title}
              </h3>
              <p className="mb-4 text-sm leading-[1.65] text-aura-text-light">
                {step.description}
              </p>

              {/* Details list */}
              <ul className="space-y-1.5">
                {step.details.map((detail) => (
                  <li key={detail} className="flex items-center gap-2 text-xs text-aura-text-dim">
                    <span className="text-aura-mint">✓</span>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 text-center">
        <p className="mb-4 text-aura-text-dim">Ready to see Aura in action?</p>
        <a
          href="https://cal.com/shadman-hossain-k6kwji/15min?overlayCalendar=true"
          className="inline-flex items-center gap-2 rounded-lg bg-aura-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-aura-accent-bright hover:shadow-[0_8px_36px_rgba(79,143,255,0.25)]"
        >
          Book a Demo
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10m0 0L9 4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      </div>
    </section>
  );
}
