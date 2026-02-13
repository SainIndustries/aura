import {
  type LucideIcon,
  Calendar,
  Mail,
  HardDrive,
  MessageSquare,
  Github,
  Users,
  FileText,
  Target,
} from "lucide-react";

export interface IntegrationProvider {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  capabilities: string[];
  scopes: string[];
  docsUrl?: string;
  category: "productivity" | "communication" | "development" | "crm";
}

export const integrationProviders: IntegrationProvider[] = [
  {
    id: "google",
    name: "Google Workspace",
    description: "Connect Calendar, Gmail, and Drive for seamless productivity",
    icon: Calendar,
    color: "#4285F4",
    capabilities: ["Calendar Events", "Email", "Drive Files", "Contacts"],
    scopes: [
      "Read and manage your calendar events",
      "Send and read emails on your behalf",
      "Access files in Google Drive",
      "View contact information",
    ],
    docsUrl: "https://developers.google.com/workspace",
    category: "productivity",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Send messages, receive notifications, and manage channels",
    icon: MessageSquare,
    color: "#4A154B",
    capabilities: ["Send Messages", "Read Channels", "Notifications", "Files"],
    scopes: [
      "Post messages to channels",
      "Read messages in channels",
      "Access workspace information",
      "Upload and share files",
    ],
    docsUrl: "https://api.slack.com",
    category: "communication",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Manage repositories, issues, pull requests, and workflows",
    icon: Github,
    color: "#24292F",
    capabilities: ["Repositories", "Issues", "Pull Requests", "Actions"],
    scopes: [
      "Access repository information",
      "Create and manage issues",
      "Read and comment on pull requests",
      "Trigger workflow actions",
    ],
    docsUrl: "https://docs.github.com/en/rest",
    category: "development",
  },
  {
    id: "hubspot",
    name: "HubSpot CRM",
    description: "Sync contacts, deals, and automate your sales pipeline",
    icon: Users,
    color: "#FF7A59",
    capabilities: ["Contacts", "Deals", "Companies", "Tasks"],
    scopes: [
      "Read and write contact records",
      "Manage deals and pipeline stages",
      "Access company information",
      "Create and update tasks",
    ],
    docsUrl: "https://developers.hubspot.com",
    category: "crm",
  },
  {
    id: "notion",
    name: "Notion",
    description: "Access pages, databases, and workspace content",
    icon: FileText,
    color: "#000000",
    capabilities: ["Pages", "Databases", "Blocks", "Comments"],
    scopes: [
      "Read page content",
      "Query and update databases",
      "Create new pages and blocks",
      "Read and post comments",
    ],
    docsUrl: "https://developers.notion.com",
    category: "productivity",
  },
  {
    id: "linear",
    name: "Linear",
    description: "Manage issues, projects, and development workflows",
    icon: Target,
    color: "#5E6AD2",
    capabilities: ["Issues", "Projects", "Cycles", "Teams"],
    scopes: [
      "Read and create issues",
      "Access project information",
      "Manage cycle planning",
      "View team structure",
    ],
    docsUrl: "https://developers.linear.app",
    category: "development",
  },
];

export function getProviderById(id: string): IntegrationProvider | undefined {
  return integrationProviders.find((p) => p.id === id);
}

// Google sub-services for detailed display
export const googleServices = [
  {
    id: "calendar",
    name: "Google Calendar",
    description: "Manage events and schedules",
    icon: Calendar,
    color: "#4285F4",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Read and send emails",
    icon: Mail,
    color: "#EA4335",
  },
  {
    id: "drive",
    name: "Google Drive",
    description: "Access files and documents",
    icon: HardDrive,
    color: "#34A853",
  },
];
