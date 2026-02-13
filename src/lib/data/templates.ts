export type TemplateCategory = "operations" | "engineering" | "communications";

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  icon: string;
  personality: string;
  goal: string;
  integrations: string[];
}

export const TEMPLATES: AgentTemplate[] = [
  {
    id: "executive-assistant",
    name: "Executive Assistant",
    description:
      "Calendar management, email drafting, meeting prep, and daily briefings.",
    category: "operations",
    icon: "📅",
    personality:
      "Professional, efficient, proactive assistant focused on keeping schedules organized.",
    goal: "Manage calendar, draft emails, prepare meeting briefs, and handle scheduling.",
    integrations: ["google", "slack"],
  },
  {
    id: "pipeline-manager",
    name: "Pipeline Manager",
    description:
      "CRM monitoring, deal follow-ups, and pipeline health reporting.",
    category: "operations",
    icon: "📊",
    personality:
      "Data-driven sales ops assistant that never lets a deal go cold.",
    goal: "Monitor CRM for stale deals, send follow-up reminders, generate pipeline reports.",
    integrations: ["hubspot", "slack"],
  },
  {
    id: "code-review-bot",
    name: "Code Review Bot",
    description: "Watches PRs, provides feedback, and suggests improvements.",
    category: "engineering",
    icon: "🔍",
    personality:
      "Thorough, constructive code reviewer focused on quality and best practices.",
    goal: "Review pull requests, flag issues, suggest improvements, approve when ready.",
    integrations: ["github", "slack"],
  },
  {
    id: "issue-triager",
    name: "Issue Triager",
    description:
      "Monitors issues, categorizes them, assigns to right team members.",
    category: "engineering",
    icon: "🎫",
    personality:
      "Organized issue manager that keeps the backlog clean and prioritized.",
    goal: "Triage incoming issues, categorize by type/severity, assign to appropriate owners.",
    integrations: ["github", "linear"],
  },
  {
    id: "email-responder",
    name: "Email Responder",
    description:
      "Drafts email responses based on context and your communication style.",
    category: "communications",
    icon: "✉️",
    personality: "Professional communicator that matches your tone and style.",
    goal: "Draft email responses, suggest replies, manage follow-ups.",
    integrations: ["google"],
  },
  {
    id: "meeting-summarizer",
    name: "Meeting Summarizer",
    description: "Processes meeting notes and creates action items.",
    category: "communications",
    icon: "📝",
    personality:
      "Detail-oriented note-taker focused on capturing decisions and next steps.",
    goal: "Summarize meetings, extract action items, assign owners, track follow-ups.",
    integrations: ["google", "notion", "slack"],
  },
];

export const CATEGORY_LABELS: Record<TemplateCategory | "all", string> = {
  all: "All",
  operations: "Operations",
  engineering: "Engineering",
  communications: "Communications",
};

export const INTEGRATION_LABELS: Record<string, { name: string; color: string }> = {
  google: { name: "Google", color: "bg-red-500/20 text-red-400" },
  slack: { name: "Slack", color: "bg-purple-500/20 text-purple-400" },
  github: { name: "GitHub", color: "bg-gray-500/20 text-gray-300" },
  hubspot: { name: "HubSpot", color: "bg-orange-500/20 text-orange-400" },
  linear: { name: "Linear", color: "bg-indigo-500/20 text-indigo-400" },
  notion: { name: "Notion", color: "bg-neutral-500/20 text-neutral-300" },
};
