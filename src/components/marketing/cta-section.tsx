const CAL_LINK =
  "https://cal.com/shadman-hossain-k6kwji/15min?overlayCalendar=true";

export function CtaSection() {
  return (
    <section className="relative px-12 pb-[120px] pt-[140px] text-center max-[960px]:px-6">
      {/* Bottom glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[500px] bg-[radial-gradient(ellipse_at_center_bottom,rgba(79,143,255,0.05),transparent_65%)]" />

      <div className="relative z-[5] mx-auto max-w-[620px]">
        <h2 className="mb-5 text-[clamp(36px,5.5vw,60px)] font-extrabold leading-[1.08] tracking-[-2.5px]">
          Everyone wanted
          <br />
          their own AI.
          <br />
          <span className="bg-gradient-to-br from-aura-accent-bright via-[#a78bfa] to-aura-accent bg-clip-text text-transparent">
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
        </div>
      </div>
    </section>
  );
}
