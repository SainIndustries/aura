const CAL_LINK =
  "https://cal.com/shadman-hossain-k6kwji/15min?overlayCalendar=true";

export function CtaSection() {
  return (
    <section className="relative px-12 pb-[120px] pt-[140px] text-center max-[960px]:px-6">
      {/* Bottom glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[500px] bg-[radial-gradient(ellipse_at_center_bottom,rgba(79,143,255,0.08),transparent_65%)] dark:bg-[radial-gradient(ellipse_at_center_bottom,rgba(79,143,255,0.05),transparent_65%)]" />

      <div className="relative z-[5] mx-auto max-w-[620px]">
        {/* Powered by badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-aura-border bg-aura-surface/80 px-4 py-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-aura-accent to-aura-purple">
            <svg
              className="h-3 w-3 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="text-sm font-medium text-aura-text-dim">
            Powered by{" "}
            <a href="https://sainindustries.com" className="text-aura-text-light hover:text-aura-accent transition-colors">
              SAIN Industries
            </a>
          </span>
        </div>

        <h2 className="mb-5 text-[clamp(36px,5.5vw,60px)] font-extrabold leading-[1.08] tracking-[-2.5px] text-aura-text-white">
          Everyone wanted
          <br />
          their own AI.
          <br />
          <span className="gradient-text">
            Build with Aura.
          </span>
        </h2>
        <p className="mb-10 text-[17px] leading-[1.7] text-aura-text-light">
          Start your 7-day free trial today. No credit card required to explore.
          Then just $199/month to deploy unlimited AI agents.
        </p>
        <div className="flex flex-wrap justify-center gap-[14px]">
          <a
            href="/onboarding"
            className="group inline-flex items-center gap-2 rounded-[10px] bg-aura-accent px-[34px] py-[15px] text-[15px] font-semibold text-white transition-all duration-[250ms] hover:-translate-y-0.5 hover:bg-aura-accent-bright hover:shadow-[0_8px_36px_rgba(79,143,255,0.25)]"
          >
            Start Free Trial
            <svg
              width="15"
              height="15"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform duration-200 group-hover:translate-x-[3px]"
            >
              <path
                d="M3 8h10m0 0L9 4m4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <a
            href="#demo"
            className="rounded-[10px] border border-aura-border bg-transparent px-[34px] py-[15px] text-[15px] font-medium text-aura-text-light transition-all duration-[250ms] hover:border-aura-border-hover hover:bg-aura-surface/50 hover:text-aura-text-white"
          >
            Watch Demo
          </a>
        </div>

        {/* Social proof */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-sm text-aura-text-dim">
            <svg className="h-5 w-5 text-aura-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>7-day free trial</span>
          </div>
          <div className="h-4 w-px bg-aura-border" />
          <div className="flex items-center gap-2 text-sm text-aura-text-dim">
            <svg className="h-5 w-5 text-aura-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Cancel anytime</span>
          </div>
          <div className="h-4 w-px bg-aura-border" />
          <div className="flex items-center gap-2 text-sm text-aura-text-dim">
            <svg className="h-5 w-5 text-aura-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>$199/month after trial</span>
          </div>
        </div>
      </div>
    </section>
  );
}
