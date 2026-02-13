const badges = [
  { value: "100%", label: "Output Traceability" },
  { value: "E2E", label: "Encrypted" },
  { value: "SOC 2", label: "Ready Architecture" },
  { value: "Zero", label: "Data Sharing" },
];

export function TrustSection() {
  return (
    <section className="mx-auto max-w-[1160px] px-12 py-20 max-[960px]:px-6">
      <div className="relative flex items-center gap-14 overflow-hidden rounded-[20px] border border-[rgba(79,143,255,0.12)] bg-gradient-to-br from-[rgba(79,143,255,0.04)] to-[rgba(124,92,252,0.03)] px-16 py-14 max-[960px]:flex-col max-[960px]:gap-9 max-[960px]:px-7 max-[960px]:py-10">
        {/* Decorative orb */}
        <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(124,92,252,0.06),transparent_65%)]" />

        <div className="relative z-[2] flex-1">
          <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
            Why Aura
          </div>
          <h2 className="mb-[14px] text-[34px] font-extrabold leading-[1.15] tracking-[-1.5px]">
            AI you can
            <br />
            actually trust.
          </h2>
          <p className="text-[15.5px] leading-[1.7] text-aura-text-light">
            Most AI assistants are black boxes. Aura is built on cryptographic
            infrastructure that makes every action auditable, every output
            verifiable, and every decision traceable. Enterprise-grade security
            isn&apos;t a feature — it&apos;s the foundation.
          </p>
        </div>

        <div className="relative z-[2] grid shrink-0 grid-cols-2 gap-[14px] max-[960px]:w-full max-[600px]:grid-cols-1">
          {badges.map((badge) => (
            <div
              key={badge.label}
              className="min-w-[140px] rounded-xl border border-[rgba(255,255,255,0.05)] bg-[rgba(2,3,8,0.55)] px-6 py-5 text-center"
            >
              <div className="mb-[3px] text-[26px] font-extrabold tracking-[-0.5px] text-aura-accent-bright">
                {badge.value}
              </div>
              <div className="text-[11.5px] font-medium tracking-[0.3px] text-aura-text-dim">
                {badge.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
