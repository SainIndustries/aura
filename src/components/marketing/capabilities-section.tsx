const capabilities = [
  {
    icon: "🎙️",
    iconBg: "bg-[rgba(79,143,255,0.08)]",
    title: "Voice-First Interface",
    description:
      "Speak naturally and Aura executes. Schedule calls, draft emails, update your pipeline, pull research — all through conversation. No dashboards. No forms. Just talk.",
    example: {
      prefix: '"Aura,',
      text: ' reschedule tomorrow\'s standup to 3pm and let the team know."',
    },
  },
  {
    icon: "🧠",
    iconBg: "bg-[rgba(52,211,153,0.08)]",
    title: "Persistent Context",
    description:
      'Aura remembers your projects, your team, your priorities. Ask "where did we leave off with Meridian?" and get an instant brief — not a blank stare.',
    example: {
      prefix: '"Aura,',
      text: " what did I commit to in last Friday's partner call?\"",
    },
  },
  {
    icon: "⚡",
    iconBg: "bg-[rgba(251,191,36,0.08)]",
    title: "Real-Time Execution",
    description:
      "Aura doesn't just suggest — it does. Sends the email. Books the room. Updates the tracker. Flags the risk. You stay in flow while Aura handles the overhead.",
    example: {
      prefix: '"Aura,',
      text: ' send the proposal to Sarah with the updated pricing deck attached."',
    },
  },
  {
    icon: "🔐",
    iconBg: "bg-[rgba(167,139,250,0.08)]",
    title: "Built on Trust",
    description:
      "Every output is verifiable. Aura runs on cryptographic infrastructure that ensures accountability at every step. Not just smart — provably trustworthy.",
    example: {
      prefix: '"Aura,',
      text: ' show me the audit trail for the deliverable we sent Monday."',
    },
  },
];

export function CapabilitiesSection() {
  return (
    <section id="what" className="mx-auto max-w-[1160px] px-12 pb-[120px] pt-[100px] max-[960px]:px-6">
      <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
        Capabilities
      </div>
      <h2 className="mb-[18px] text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px]">
        One AI that
        <br />
        runs everything.
      </h2>
      <p className="mb-[72px] max-w-[480px] text-[16.5px] leading-[1.75] text-aura-text-light">
        Aura isn&apos;t a chatbot. It&apos;s an operations layer — connecting
        your calendar, comms, pipeline, and projects into one intelligence that
        learns how you work.
      </p>
      <div className="grid grid-cols-2 gap-[18px] max-[960px]:grid-cols-1">
        {capabilities.map((cap) => (
          <div
            key={cap.title}
            className="group relative overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.05)] bg-aura-surface px-8 py-10 transition-all duration-[350ms] [transition-timing-function:cubic-bezier(0.22,0.61,0.36,1)] hover:-translate-y-1 hover:border-[rgba(79,143,255,0.12)] hover:bg-aura-elevated hover:shadow-[0_16px_48px_rgba(0,0,0,0.3),0_0_40px_-10px_rgba(79,143,255,0.12)]"
          >
            {/* Top accent line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aura-accent to-transparent opacity-0 transition-opacity duration-[350ms] group-hover:opacity-100" />
            <div
              className={`mb-[22px] grid h-[50px] w-[50px] place-items-center rounded-[13px] text-[23px] ${cap.iconBg}`}
            >
              {cap.icon}
            </div>
            <h3 className="mb-[10px] text-lg font-bold tracking-[-0.4px]">
              {cap.title}
            </h3>
            <p className="text-[14.5px] leading-[1.7] text-aura-text-light">
              {cap.description}
            </p>
            <div className="mt-[18px] rounded-lg border-l-2 border-aura-accent bg-[rgba(0,0,0,0.25)] px-4 py-3 font-mono text-[12.5px] leading-[1.6] text-aura-text-dim">
              <span className="text-aura-accent-bright">{cap.example.prefix}</span>
              {cap.example.text}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
