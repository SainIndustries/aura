const steps = [
  {
    num: 1,
    title: "Connect Your Tools",
    description:
      "Calendar, email, Slack, your CRM — Aura plugs into where you already work. No migration. No learning curve.",
  },
  {
    num: 2,
    title: "Talk to Aura",
    description:
      "Voice or text — tell Aura what you need. It learns your patterns, your team, your priorities with every interaction.",
  },
  {
    num: 3,
    title: "Watch It Run",
    description:
      "Aura executes in real-time. Meetings booked. Emails drafted. Pipelines updated. You just operate.",
  },
];

export function HowItWorksSection() {
  return (
    <section id="how" className="mx-auto max-w-[1160px] px-12 pb-[120px] pt-[100px] max-[960px]:px-6">
      <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
        How It Works
      </div>
      <h2 className="mb-[18px] text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px]">
        Three steps to
        <br />
        <span className="bg-gradient-to-br from-aura-accent-bright via-[#a78bfa] to-aura-accent bg-clip-text text-transparent">
          more.
        </span>
      </h2>
      <p className="mb-[72px] max-w-[480px] text-[16.5px] leading-[1.75] text-aura-text-light">
        Getting started with Aura takes less time than scheduling a meeting the
        old way.
      </p>
      <div className="relative grid grid-cols-3 gap-[18px] max-[960px]:grid-cols-1">
        {/* Connecting line */}
        <div className="absolute left-[16.6%] right-[16.6%] top-[44px] h-px bg-gradient-to-r from-transparent via-[rgba(79,143,255,0.12)] to-transparent max-[960px]:hidden" />

        {steps.map((step) => (
          <div key={step.num} className="relative z-[1] text-center">
            <div className="mb-6 inline-grid h-12 w-12 place-items-center rounded-full border-2 border-aura-accent bg-aura-surface text-base font-bold text-aura-accent-bright shadow-[0_0_24px_rgba(79,143,255,0.12)]">
              {step.num}
            </div>
            <h3 className="mb-2 text-[17px] font-bold tracking-[-0.3px]">
              {step.title}
            </h3>
            <p className="mx-auto max-w-[280px] text-sm leading-[1.65] text-aura-text-light">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
