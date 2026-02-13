const CAL_LINK =
  "https://cal.com/shadman-hossain-k6kwji/15min?overlayCalendar=true";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pb-[60px] pt-[120px] text-center">
      {/* Orb - adjusts for theme */}
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,143,255,0.07)_0%,rgba(124,92,252,0.03)_35%,transparent_65%)] animate-orb-breathe dark:bg-[radial-gradient(circle,rgba(79,143,255,0.1)_0%,rgba(124,92,252,0.05)_35%,transparent_65%)]" />

      {/* Grid - lighter in light mode */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(rgba(79,143,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(79,143,255,0.03) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 30%, black 10%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 30%, black 10%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-[5] max-w-[780px]">
        <div className="mb-9 inline-flex animate-fade-slide-up items-center gap-2 rounded-full border border-aura-accent/20 bg-aura-accent/10 px-4 py-[5px] pl-[7px] text-[12.5px] font-medium text-aura-accent">
          <span className="h-[7px] w-[7px] rounded-full bg-aura-mint animate-blink" />
          Now in Early Access
        </div>

        <h1 className="mb-7 animate-fade-slide-up text-[clamp(46px,7.5vw,84px)] font-extrabold leading-[1.02] tracking-[-3.5px] text-aura-text-white [animation-delay:0.08s] max-[600px]:tracking-[-2px]">
          Your AI.
          <br />
          <span className="gradient-text">
            More of it.
          </span>
        </h1>

        <p className="mx-auto mb-11 max-w-[520px] animate-fade-slide-up text-lg font-normal leading-[1.75] text-aura-text-light [animation-delay:0.16s]">
          Aura is the AI that actually runs with you — scheduling, research,
          communications, pipeline — unified under one intelligence layer built
          for people who operate.
        </p>

        <div className="flex flex-wrap justify-center gap-[14px] animate-fade-slide-up [animation-delay:0.24s]">
          <a
            href={CAL_LINK}
            className="group inline-flex items-center gap-2 rounded-[10px] bg-aura-accent px-[34px] py-[15px] text-[15px] font-semibold text-white transition-all duration-[250ms] hover:-translate-y-0.5 hover:bg-aura-accent-bright hover:shadow-[0_8px_36px_rgba(79,143,255,0.25)]"
          >
            Get Early Access
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
            See What Aura Does
          </a>
        </div>

        {/* Trust badges */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-6 animate-fade-slide-up [animation-delay:0.32s]">
          <div className="flex items-center gap-2 text-xs text-aura-text-dim">
            <svg className="h-4 w-4 text-aura-mint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>SOC 2 Ready</span>
          </div>
          <div className="h-4 w-px bg-aura-border" />
          <div className="flex items-center gap-2 text-xs text-aura-text-dim">
            <svg className="h-4 w-4 text-aura-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>End-to-End Encrypted</span>
          </div>
          <div className="h-4 w-px bg-aura-border" />
          <div className="flex items-center gap-2 text-xs text-aura-text-dim">
            <svg className="h-4 w-4 text-aura-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <span>100% Audit Trail</span>
          </div>
        </div>
      </div>
    </section>
  );
}
