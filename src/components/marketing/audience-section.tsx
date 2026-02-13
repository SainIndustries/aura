const personas = [
  {
    emoji: "🚀",
    title: "Founders & CEOs",
    description:
      "You're the calendar, the CRM, the ops team, and the closer. Aura gives you back the hours you lose to context-switching so you can focus on building.",
  },
  {
    emoji: "🏗️",
    title: "Contractors & Consultants",
    description:
      "Managing multiple clients, deadlines, and deliverables across complex organizations. Aura tracks what you can't and surfaces what matters before you ask.",
  },
  {
    emoji: "🎯",
    title: "BD & Operations Leads",
    description:
      "Pipeline tracking, follow-up cadences, proposal timelines — Aura keeps your deals moving and flags when something goes quiet before it goes cold.",
  },
];

export function AudienceSection() {
  return (
    <section id="who" className="mx-auto max-w-[1160px] px-12 pb-[120px] pt-[100px] max-[960px]:px-6">
      <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
        Built For
      </div>
      <h2 className="mb-[18px] text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px]">
        Operators. Builders.
        <br />
        People who ship.
      </h2>
      <p className="mb-[72px] max-w-[480px] text-[16.5px] leading-[1.75] text-aura-text-light">
        Aura is for anyone who runs too many things to keep in their head — and
        needs an AI that keeps up.
      </p>
      <div className="grid grid-cols-3 gap-[18px] max-[960px]:grid-cols-1">
        {personas.map((persona) => (
          <div
            key={persona.title}
            className="rounded-2xl border border-[rgba(255,255,255,0.05)] bg-aura-surface px-7 py-9 transition-all duration-300 hover:-translate-y-[3px] hover:border-[rgba(79,143,255,0.12)]"
          >
            <span className="mb-[18px] block text-[32px]">
              {persona.emoji}
            </span>
            <h3 className="mb-[10px] text-[17px] font-bold tracking-[-0.3px]">
              {persona.title}
            </h3>
            <p className="text-sm leading-[1.7] text-aura-text-light">
              {persona.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
