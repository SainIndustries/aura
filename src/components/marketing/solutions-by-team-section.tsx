"use client";

const teams = [
  {
    id: "engineering",
    icon: "⚡",
    iconBg: "from-amber-400 to-orange-500",
    title: "Engineering",
    subtitle: "Ship faster, context-switch less",
    workflows: [
      {
        trigger: "\"@Aura, what's blocking the release?\"",
        action: "Pulls from Jira, GitHub, and Slack to surface blockers",
      },
      {
        trigger: "\"@Aura, summarize the PR feedback\"",
        action: "Synthesizes code review comments into action items",
      },
      {
        trigger: "\"@Aura, schedule a sync with backend\"",
        action: "Finds mutual time and sends calendar invites",
      },
    ],
  },
  {
    id: "sales",
    icon: "🎯",
    iconBg: "from-aura-accent to-blue-500",
    title: "Sales",
    subtitle: "Close deals, not tabs",
    workflows: [
      {
        trigger: "\"@Aura, brief me on the Acme deal\"",
        action: "Compiles call notes, emails, and CRM data into a brief",
      },
      {
        trigger: "\"@Aura, any deals going cold?\"",
        action: "Surfaces deals with no activity in 7+ days",
      },
      {
        trigger: "\"@Aura, draft a follow-up to Sarah\"",
        action: "Creates personalized email with context from last touch",
      },
    ],
  },
  {
    id: "operations",
    icon: "🏗️",
    iconBg: "from-emerald-400 to-teal-500",
    title: "Operations",
    subtitle: "Run projects, not status meetings",
    workflows: [
      {
        trigger: "\"@Aura, status on Q2 initiatives\"",
        action: "Aggregates progress from all project tools",
      },
      {
        trigger: "\"@Aura, generate the weekly report\"",
        action: "Creates summary from team updates and metrics",
      },
      {
        trigger: "\"@Aura, who owns the vendor contract?\"",
        action: "Searches docs and conversations to find the answer",
      },
    ],
  },
  {
    id: "founders",
    icon: "🚀",
    iconBg: "from-aura-purple to-pink-500",
    title: "Founders & Executives",
    subtitle: "Lead, don't administrate",
    workflows: [
      {
        trigger: "\"@Aura, what needs my attention today?\"",
        action: "Prioritizes based on urgency, deadlines, and context",
      },
      {
        trigger: "\"@Aura, prep me for the board meeting\"",
        action: "Compiles metrics, risks, and talking points",
      },
      {
        trigger: "\"@Aura, reschedule all Thursday meetings\"",
        action: "Coordinates with all attendees to find new times",
      },
    ],
  },
];

export function SolutionsByTeamSection() {
  return (
    <section id="who" className="mx-auto max-w-[1160px] px-12 py-[100px] max-[960px]:px-6">
      <div className="mb-[14px] text-[11.5px] font-bold uppercase tracking-[3px] text-aura-accent">
        Solutions
      </div>
      <h2 className="mb-5 text-[clamp(30px,4.5vw,50px)] font-extrabold leading-[1.08] tracking-[-2.5px] text-aura-text-white">
        Built for every team
        <br />
        <span className="gradient-text">that operates.</span>
      </h2>
      <p className="mb-12 max-w-[520px] text-[16.5px] leading-[1.75] text-aura-text-light">
        Aura adapts to how your team works — whether you&apos;re shipping code, 
        closing deals, or running the company.
      </p>

      {/* Teams grid */}
      <div className="grid grid-cols-2 gap-6 max-[768px]:grid-cols-1">
        {teams.map((team) => (
          <div
            key={team.id}
            className="group relative overflow-hidden rounded-2xl border border-aura-border bg-aura-surface p-6 transition-all duration-300 hover:border-aura-border-hover card-hover"
          >
            {/* Top accent line */}
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-aura-accent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            {/* Header */}
            <div className="mb-5 flex items-center gap-4">
              <div
                className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${team.iconBg} text-2xl`}
              >
                {team.icon}
              </div>
              <div>
                <h3 className="text-lg font-bold text-aura-text-white">{team.title}</h3>
                <p className="text-sm text-aura-text-dim">{team.subtitle}</p>
              </div>
            </div>

            {/* Example workflows */}
            <div className="space-y-3">
              {team.workflows.map((workflow, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-aura-border bg-aura-void/50 p-3"
                >
                  <div className="mb-1.5 flex items-start gap-2">
                    <span className="mt-0.5 text-aura-accent">→</span>
                    <span className="text-sm font-medium text-aura-text-white">
                      {workflow.trigger}
                    </span>
                  </div>
                  <p className="ml-5 text-xs text-aura-text-dim">{workflow.action}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom callout */}
      <div className="mt-10 rounded-2xl border border-aura-accent/20 bg-aura-accent/5 p-6 text-center">
        <p className="text-lg font-medium text-aura-text-white">
          Don&apos;t see your team?{" "}
          <span className="text-aura-accent">Aura adapts to any workflow.</span>
        </p>
        <p className="mt-2 text-sm text-aura-text-dim">
          Custom agents, custom integrations, custom automations — built for how you operate.
        </p>
      </div>
    </section>
  );
}
