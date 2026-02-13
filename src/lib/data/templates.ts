export type TemplateCategory =
  | "operations"
  | "engineering"
  | "communications"
  | "sales"
  | "marketing"
  | "support";

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
  // ===== SALES & OUTREACH =====
  {
    id: "sales-development-rep",
    name: "Sales Development Rep (SDR)",
    description:
      "Automated lead qualification, outreach sequences, and meeting booking.",
    category: "sales",
    icon: "🎯",
    personality:
      "Persistent but professional sales assistant focused on pipeline generation.",
    goal: "Qualify inbound leads, send personalized outreach, book discovery calls, update CRM.",
    integrations: ["hubspot", "salesforce", "gmail", "linkedin"],
  },
  {
    id: "account-executive-assistant",
    name: "Account Executive Assistant",
    description:
      "Deal management, proposal preparation, and follow-up automation.",
    category: "sales",
    icon: "💼",
    personality:
      "Strategic sales partner focused on closing deals and maintaining relationships.",
    goal: "Track deal stages, prepare proposals, send follow-ups, forecast pipeline.",
    integrations: ["salesforce", "hubspot", "gmail", "slack"],
  },
  {
    id: "customer-success-manager",
    name: "Customer Success Manager",
    description:
      "Proactive customer health monitoring and renewal management.",
    category: "sales",
    icon: "🤝",
    personality:
      "Customer-focused advocate ensuring satisfaction and preventing churn.",
    goal: "Monitor usage metrics, flag at-risk accounts, schedule QBRs, manage renewals.",
    integrations: ["hubspot", "intercom", "slack", "gmail"],
  },
  {
    id: "cold-outreach-specialist",
    name: "Cold Outreach Specialist",
    description:
      "High-volume personalized cold email and LinkedIn outreach.",
    category: "sales",
    icon: "📧",
    personality:
      "Creative copywriter focused on personalization and response rates.",
    goal: "Research prospects, craft personalized messages, A/B test sequences, track replies.",
    integrations: ["linkedin", "gmail", "hubspot"],
  },

  // ===== MARKETING =====
  {
    id: "content-marketing-assistant",
    name: "Content Marketing Assistant",
    description:
      "Blog writing, social media content, and content calendar management.",
    category: "marketing",
    icon: "✍️",
    personality:
      "Creative marketer with strong writing skills and brand awareness.",
    goal: "Draft blog posts, schedule social content, repurpose content across channels.",
    integrations: ["notion", "slack", "buffer", "google"],
  },
  {
    id: "social-media-manager",
    name: "Social Media Manager",
    description:
      "Multi-platform social scheduling, engagement monitoring, and analytics.",
    category: "marketing",
    icon: "📱",
    personality:
      "Trend-aware social strategist focused on engagement and growth.",
    goal: "Schedule posts, respond to comments, track metrics, identify viral opportunities.",
    integrations: ["twitter", "linkedin", "buffer", "slack"],
  },
  {
    id: "seo-analyst",
    name: "SEO Analyst",
    description:
      "Keyword research, content optimization, and ranking monitoring.",
    category: "marketing",
    icon: "🔍",
    personality:
      "Data-driven SEO specialist focused on organic growth.",
    goal: "Research keywords, audit content, track rankings, suggest optimizations.",
    integrations: ["google", "ahrefs", "notion", "slack"],
  },
  {
    id: "campaign-manager",
    name: "Campaign Manager",
    description:
      "Marketing campaign execution, A/B testing, and performance tracking.",
    category: "marketing",
    icon: "📊",
    personality:
      "Analytical marketer focused on ROI and conversion optimization.",
    goal: "Launch campaigns, monitor performance, optimize spend, report results.",
    integrations: ["hubspot", "google", "slack", "notion"],
  },

  // ===== ENGINEERING =====
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
    id: "devops-assistant",
    name: "DevOps Assistant",
    description:
      "Deployment monitoring, incident response, and infrastructure alerts.",
    category: "engineering",
    icon: "🚀",
    personality:
      "Reliability-focused engineer keeping systems healthy 24/7.",
    goal: "Monitor deployments, alert on issues, coordinate incident response, track SLAs.",
    integrations: ["github", "datadog", "pagerduty", "slack"],
  },
  {
    id: "security-analyst",
    name: "Security Analyst",
    description:
      "Security alert triage, vulnerability tracking, and compliance monitoring.",
    category: "engineering",
    icon: "🔒",
    personality:
      "Security-minded analyst protecting systems and data.",
    goal: "Triage security alerts, track vulnerabilities, ensure compliance, report risks.",
    integrations: ["github", "jira", "slack", "snyk"],
  },
  {
    id: "documentation-writer",
    name: "Documentation Writer",
    description:
      "API docs, README files, and technical documentation maintenance.",
    category: "engineering",
    icon: "📚",
    personality:
      "Clear technical writer making complex things simple.",
    goal: "Write API docs, update READMEs, maintain wikis, improve developer experience.",
    integrations: ["github", "notion", "slack"],
  },
  {
    id: "release-manager",
    name: "Release Manager",
    description:
      "Release coordination, changelog generation, and deployment scheduling.",
    category: "engineering",
    icon: "🏷️",
    personality:
      "Organized coordinator ensuring smooth releases.",
    goal: "Coordinate releases, generate changelogs, notify stakeholders, track versions.",
    integrations: ["github", "jira", "slack", "linear"],
  },

  // ===== OPERATIONS & PRODUCTIVITY =====
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
    id: "hr-assistant",
    name: "HR Assistant",
    description:
      "Interview scheduling, onboarding coordination, and HR task automation.",
    category: "operations",
    icon: "👥",
    personality:
      "People-focused assistant streamlining HR workflows.",
    goal: "Schedule interviews, coordinate onboarding, manage HR requests, track PTO.",
    integrations: ["google", "slack", "notion", "greenhouse"],
  },
  {
    id: "finance-assistant",
    name: "Finance Assistant",
    description:
      "Expense tracking, invoice management, and financial reporting.",
    category: "operations",
    icon: "💰",
    personality:
      "Detail-oriented assistant keeping finances organized.",
    goal: "Track expenses, process invoices, generate reports, flag anomalies.",
    integrations: ["quickbooks", "google", "slack", "stripe"],
  },
  {
    id: "legal-assistant",
    name: "Legal Assistant",
    description:
      "Contract review, NDA tracking, and legal document management.",
    category: "operations",
    icon: "⚖️",
    personality:
      "Thorough assistant ensuring legal compliance.",
    goal: "Track contracts, manage NDAs, flag renewal dates, organize legal docs.",
    integrations: ["google", "docusign", "notion", "slack"],
  },
  {
    id: "research-assistant",
    name: "Research Assistant",
    description:
      "Market research, competitive analysis, and data synthesis.",
    category: "operations",
    icon: "🔬",
    personality:
      "Curious researcher delivering actionable insights.",
    goal: "Research competitors, analyze markets, synthesize findings, create briefs.",
    integrations: ["notion", "google", "slack"],
  },
  {
    id: "personal-productivity-agent",
    name: "Personal Productivity Agent",
    description:
      "Task management, daily planning, and personal workflow optimization.",
    category: "operations",
    icon: "⚡",
    personality:
      "Proactive assistant helping you stay organized and focused.",
    goal: "Manage tasks, plan days, set reminders, track habits, reduce friction.",
    integrations: ["google", "todoist", "slack", "notion"],
  },
  {
    id: "meeting-assistant",
    name: "Meeting Assistant",
    description:
      "Meeting scheduling, agenda prep, notes, and action item tracking.",
    category: "operations",
    icon: "🗓️",
    personality:
      "Organized assistant ensuring productive meetings.",
    goal: "Schedule meetings, prepare agendas, take notes, track action items.",
    integrations: ["google", "zoom", "slack", "notion"],
  },

  // ===== COMMUNICATIONS =====
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

  // ===== SUPPORT =====
  {
    id: "customer-support-agent",
    name: "Customer Support Agent",
    description:
      "Ticket triage, response drafting, and escalation management.",
    category: "support",
    icon: "🎧",
    personality:
      "Empathetic support agent resolving issues quickly.",
    goal: "Triage tickets, draft responses, escalate issues, track satisfaction.",
    integrations: ["zendesk", "intercom", "slack", "notion"],
  },
  {
    id: "technical-support-agent",
    name: "Technical Support Agent",
    description:
      "Technical troubleshooting, bug reporting, and solution documentation.",
    category: "support",
    icon: "🛠️",
    personality:
      "Patient technical expert solving complex problems.",
    goal: "Diagnose issues, document solutions, report bugs, update knowledge base.",
    integrations: ["zendesk", "jira", "github", "slack"],
  },
];

export const CATEGORY_LABELS: Record<TemplateCategory | "all", string> = {
  all: "All",
  sales: "Sales & Outreach",
  marketing: "Marketing",
  engineering: "Engineering",
  operations: "Operations & Productivity",
  communications: "Communications",
  support: "Support",
};

export const INTEGRATION_LABELS: Record<string, { name: string; color: string }> = {
  // Core
  google: { name: "Google", color: "bg-red-500/20 text-red-400" },
  slack: { name: "Slack", color: "bg-purple-500/20 text-purple-400" },
  gmail: { name: "Gmail", color: "bg-red-500/20 text-red-400" },
  
  // Engineering & Dev
  github: { name: "GitHub", color: "bg-gray-500/20 text-gray-300" },
  linear: { name: "Linear", color: "bg-indigo-500/20 text-indigo-400" },
  jira: { name: "Jira", color: "bg-blue-500/20 text-blue-400" },
  datadog: { name: "Datadog", color: "bg-purple-500/20 text-purple-400" },
  pagerduty: { name: "PagerDuty", color: "bg-green-500/20 text-green-400" },
  snyk: { name: "Snyk", color: "bg-purple-600/20 text-purple-300" },
  
  // Sales & CRM
  hubspot: { name: "HubSpot", color: "bg-orange-500/20 text-orange-400" },
  salesforce: { name: "Salesforce", color: "bg-blue-500/20 text-blue-400" },
  linkedin: { name: "LinkedIn", color: "bg-blue-600/20 text-blue-300" },
  
  // Marketing & Social
  twitter: { name: "Twitter/X", color: "bg-gray-500/20 text-gray-300" },
  buffer: { name: "Buffer", color: "bg-blue-400/20 text-blue-300" },
  ahrefs: { name: "Ahrefs", color: "bg-orange-600/20 text-orange-300" },
  
  // Productivity & Docs
  notion: { name: "Notion", color: "bg-neutral-500/20 text-neutral-300" },
  todoist: { name: "Todoist", color: "bg-red-600/20 text-red-300" },
  zoom: { name: "Zoom", color: "bg-blue-500/20 text-blue-400" },
  
  // Support
  zendesk: { name: "Zendesk", color: "bg-green-500/20 text-green-400" },
  intercom: { name: "Intercom", color: "bg-blue-500/20 text-blue-400" },
  
  // Finance & Legal
  quickbooks: { name: "QuickBooks", color: "bg-green-600/20 text-green-300" },
  stripe: { name: "Stripe", color: "bg-purple-500/20 text-purple-400" },
  docusign: { name: "DocuSign", color: "bg-yellow-500/20 text-yellow-400" },
  
  // HR
  greenhouse: { name: "Greenhouse", color: "bg-green-500/20 text-green-400" },
};
