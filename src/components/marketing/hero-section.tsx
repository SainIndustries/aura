const CAL_LINK =
  "https://cal.com/shadman-hossain-k6kwji/15min?overlayCalendar=true";

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pb-[60px] pt-[120px] text-center">
      {/* Orb */}
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(79,143,255,0.07)_0%,rgba(124,92,252,0.03)_35%,transparent_65%)] animate-orb-breathe" />

      {/* Grid */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(rgba(79,143,255,0.018) 1px, transparent 1px), linear-gradient(90deg, rgba(79,143,255,0.018) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          maskImage:
            "radial-gradient(ellipse 60% 50% at 50% 30%, black 10%, transparent 70%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 60% 50% at 50% 30%, black 10%, transparent 70%)",
        }}
      />

      {/* Content */}
      <div className="relative z-[5] max-w-[780px]">
        <div className="mb-9 inline-flex animate-fade-slide-up items-center gap-2 rounded-full border border-[rgba(79,143,255,0.12)] bg-[rgba(79,143,255,0.06)] px-4 py-[5px] pl-[7px] text-[12.5px] font-medium text-aura-accent-bright">
          <span className="h-[7px] w-[7px] rounded-full bg-aura-mint animate-blink" />
          Now in Early Access
        </div>

        <h1 className="mb-7 animate-fade-slide-up text-[clamp(46px,7.5vw,84px)] font-extrabold leading-[1.02] tracking-[-3.5px] [animation-delay:0.08s] max-[600px]:tracking-[-2px]">
          Your AI.
          <br />
          <span className="bg-gradient-to-br from-aura-accent-bright via-[#a78bfa] to-aura-accent bg-clip-text text-transparent">
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
            href="#what"
            className="rounded-[10px] border border-[rgba(255,255,255,0.05)] bg-transparent px-[34px] py-[15px] text-[15px] font-medium text-aura-text-light transition-all duration-[250ms] hover:border-aura-text-dim hover:bg-[rgba(255,255,255,0.02)] hover:text-aura-text-white"
          >
            See What Aura Does
          </a>
        </div>
      </div>
    </section>
  );
}
