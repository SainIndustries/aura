"use client";

const problems = [
  {
    stat: "23 min",
    description: "Average time to refocus after each interruption",
    source: "UC Irvine Study",
  },
  {
    stat: "40%",
    description: "Of productive time lost to context switching",
    source: "RescueTime Research",
  },
  {
    stat: "2.5 hrs",
    description: "Spent daily on email and message management",
    source: "McKinsey Global Institute",
  },
  {
    stat: "9+",
    description: "Apps the average knowledge worker toggles between",
    source: "Asana Workplace Study",
  },
];

export function ProblemSection() {
  return (
    <section className="relative mx-auto max-w-[1160px] px-12 py-[100px] max-[960px]:px-6">
      {/* Background gradient */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-aura-accent/[0.02] to-transparent" />

      <div className="relative z-10">
        <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
          The Problem
        </div>
        <h2 className="mb-5 text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px] text-aura-text-white">
          You&apos;re drowning in
          <br />
          <span className="gradient-text">operational overhead.</span>
        </h2>
        <p className="mb-12 max-w-[520px] text-[16.5px] leading-[1.75] text-aura-text-light">
          Every day, high-performers lose hours to the invisible tax of context switching, 
          tool-hopping, and administrative busywork. The cost compounds.
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-5 max-[960px]:grid-cols-2 max-[600px]:grid-cols-1">
          {problems.map((problem) => (
            <div
              key={problem.stat}
              className="group relative overflow-hidden rounded-2xl border border-aura-border bg-aura-surface p-6 transition-all duration-300 hover:border-aura-border-hover card-hover"
            >
              {/* Decorative top accent */}
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-aura-accent/50 via-aura-purple/50 to-aura-accent/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              
              <div className="mb-3 text-[40px] font-extrabold tracking-[-2px] text-aura-accent">
                {problem.stat}
              </div>
              <p className="mb-3 text-sm leading-relaxed text-aura-text-light">
                {problem.description}
              </p>
              <p className="text-xs text-aura-text-ghost">
                {problem.source}
              </p>
            </div>
          ))}
        </div>

        {/* Pain point callout */}
        <div className="mt-12 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-amber-500/10 p-2.5">
                <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="mb-1 font-bold text-aura-text-white">The hidden cost of being busy</h3>
                <p className="text-sm text-aura-text-light">
                  Traditional AI chatbots add another tab. Aura eliminates tabs entirely.
                </p>
              </div>
            </div>
            <a
              href="#solution"
              className="inline-flex items-center gap-2 rounded-lg bg-aura-surface border border-aura-border px-4 py-2.5 text-sm font-medium text-aura-text-light transition-all hover:border-aura-border-hover hover:text-aura-text-white"
            >
              See the solution
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 8h8m0 0L8 4m4 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
