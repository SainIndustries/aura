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
          Aura is in early access for operators who move fast and need an AI that
          keeps up. Request access and see what more looks like.
        </p>
        <div className="flex flex-wrap justify-center gap-[14px]">
          <a
            href={CAL_LINK}
            className="group inline-flex items-center gap-2 rounded-[10px] bg-aura-accent px-[34px] py-[15px] text-[15px] font-semibold text-white transition-all duration-[250ms] hover:-translate-y-0.5 hover:bg-aura-accent-bright hover:shadow-[0_8px_36px_rgba(79,143,255,0.25)]"
          >
            Request Early Access
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
          <div className="flex -space-x-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-full border-2 border-aura-void bg-gradient-to-br from-aura-accent/30 to-aura-purple/30"
              />
            ))}
          </div>
          <p className="text-sm text-aura-text-dim">
            Join <span className="font-medium text-aura-text-light">200+</span> teams already on the waitlist
          </p>
        </div>
      </div>
    </section>
  );
}
