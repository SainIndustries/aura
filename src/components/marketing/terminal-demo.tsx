"use client";

const lines = [
  {
    type: "prompt",
    text: "Set up a call with Marcus for Thursday to discuss the pilot program",
  },
  {
    type: "response",
    text: "Checking availability... found a mutual slot Thu 2/20 at 10:30 AM.",
  },
  {
    type: "ok",
    text: "Calendar invite sent to Marcus Chen — Thu 2/20, 10:30 AM ET",
  },
  { type: "blank" },
  {
    type: "prompt",
    text: "Draft a follow-up email to the team about next week's deliverables",
  },
  {
    type: "response",
    text: "Pulling context from your last 3 standups and the project tracker...",
  },
  {
    type: "ok",
    text: "Draft ready — 4 action items, assigned owners, deadline callouts",
  },
  { type: "blank" },
  {
    type: "prompt",
    text: "What's the status on our pipeline? Anything I should follow up on today?",
  },
  {
    type: "ok",
    text: "3 deals in play. The Meridian contract went quiet — last touch was 9 days ago. Suggest a check-in.",
  },
];

const delays = [0.9, 1.8, 2.7, 3.4, 4.4, 5.3, 6.2, 7.0, 7.8, 8.6];

export function TerminalDemo() {
  return (
    <section className="relative z-[5] flex justify-center px-6 pb-[140px] pt-5">
      <div className="w-full max-w-[680px] animate-fade-slide-up overflow-hidden rounded-[14px] border border-[rgba(255,255,255,0.05)] bg-aura-surface shadow-[0_32px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.025)_inset,0_0_120px_-40px_rgba(79,143,255,0.12)] [animation-delay:0.4s]">
        {/* Title bar */}
        <div className="flex items-center gap-[7px] border-b border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.015)] px-[18px] py-[14px]">
          <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
          <span className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
          <span className="flex-1 text-center font-mono text-xs font-medium text-aura-text-ghost">
            aura &middot; active session
          </span>
        </div>

        {/* Body */}
        <div className="px-[22px] py-[26px] pb-[30px] font-mono text-[13.5px] leading-[2.1]">
          {lines.map((line, i) => (
            <div
              key={i}
              className="opacity-0 animate-type-line"
              style={{ animationDelay: `${delays[i]}s` }}
            >
              {line.type === "blank" ? (
                <>&nbsp;</>
              ) : line.type === "prompt" ? (
                <>
                  <span className="text-aura-accent-bright">you →</span>{" "}
                  <span className="text-aura-text-white">{line.text}</span>
                </>
              ) : line.type === "response" ? (
                <span className="text-aura-text-light">↳ {line.text}</span>
              ) : (
                <span className="text-aura-mint">✓ {line.text}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
