const badges = [
  { 
    value: "100%", 
    label: "Output Traceability",
    icon: (
      <svg className="h-5 w-5 text-aura-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  { 
    value: "E2E", 
    label: "Encrypted",
    icon: (
      <svg className="h-5 w-5 text-aura-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  { 
    value: "SOC 2", 
    label: "Ready Architecture",
    icon: (
      <svg className="h-5 w-5 text-aura-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  { 
    value: "Zero", 
    label: "Data Sharing",
    icon: (
      <svg className="h-5 w-5 text-aura-amber" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
  },
];

const securityFeatures = [
  {
    title: "Cryptographic Verification",
    description: "Every action Aura takes is cryptographically signed and verifiable. No black boxes.",
  },
  {
    title: "Role-Based Access",
    description: "Granular permissions control what Aura can see and do. You're always in control.",
  },
  {
    title: "Data Residency",
    description: "Choose where your data lives. US, EU, or your own infrastructure.",
  },
  {
    title: "Audit Logging",
    description: "Complete audit trail of every interaction. Export anytime.",
  },
];

export function TrustSection() {
  return (
    <section className="mx-auto max-w-[1160px] px-12 py-20 max-[960px]:px-6">
      <div className="relative flex flex-col gap-10 overflow-hidden rounded-[20px] border border-aura-accent/20 bg-gradient-to-br from-aura-accent/5 to-aura-purple/5 px-10 py-12 max-[960px]:px-6 max-[960px]:py-8">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(124,92,252,0.08),transparent_65%)]" />
        <div className="pointer-events-none absolute -bottom-[60px] -left-[60px] h-[200px] w-[200px] rounded-full bg-[radial-gradient(circle,rgba(79,143,255,0.08),transparent_65%)]" />

        {/* Header */}
        <div className="relative z-[2]">
          <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
            Security & Trust
          </div>
          <h2 className="mb-4 text-[34px] font-extrabold leading-[1.15] tracking-[-1.5px] text-aura-text-white">
            AI you can
            <br />
            <span className="gradient-text">actually trust.</span>
          </h2>
          <p className="max-w-[500px] text-[15.5px] leading-[1.7] text-aura-text-light">
            Most AI assistants are black boxes. Aura is built on cryptographic
            infrastructure that makes every action auditable, every output
            verifiable, and every decision traceable.
          </p>
        </div>

        {/* Stats grid */}
        <div className="relative z-[2] grid grid-cols-4 gap-4 max-[960px]:grid-cols-2 max-[600px]:grid-cols-1">
          {badges.map((badge) => (
            <div
              key={badge.label}
              className="rounded-xl border border-aura-border bg-aura-surface/80 px-5 py-5"
            >
              <div className="mb-3">{badge.icon}</div>
              <div className="mb-[3px] text-[28px] font-extrabold tracking-[-0.5px] text-aura-accent">
                {badge.value}
              </div>
              <div className="text-[12px] font-medium text-aura-text-dim">
                {badge.label}
              </div>
            </div>
          ))}
        </div>

        {/* Security features */}
        <div className="relative z-[2] grid grid-cols-2 gap-4 max-[768px]:grid-cols-1">
          {securityFeatures.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-3 rounded-lg border border-aura-border bg-aura-surface/50 p-4"
            >
              <div className="mt-0.5 text-aura-mint">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 text-sm font-semibold text-aura-text-white">{feature.title}</h3>
                <p className="text-xs leading-relaxed text-aura-text-dim">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Enterprise callout */}
        <div className="relative z-[2] flex flex-col items-center justify-between gap-4 rounded-xl border border-aura-border bg-aura-void/50 p-5 md:flex-row">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-aura-accent/10">
              <svg className="h-6 w-6 text-aura-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-aura-text-white">Enterprise Ready</h3>
              <p className="text-sm text-aura-text-dim">Custom deployment, SSO, and dedicated support available.</p>
            </div>
          </div>
          <a
            href="https://cal.com/shadman-hossain-k6kwji/15min?overlayCalendar=true"
            className="inline-flex items-center gap-2 rounded-lg border border-aura-border bg-aura-surface px-4 py-2 text-sm font-medium text-aura-text-light transition-all hover:border-aura-border-hover hover:text-aura-text-white"
          >
            Contact Sales
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10m0 0L9 4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}
