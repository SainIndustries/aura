import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// Define minimal schema needed for seeding
const auditLogCategoryEnum = pgEnum("audit_log_category", [
  "agent",
  "communication",
  "calendar",
  "pipeline",
  "integration",
  "system",
  "billing",
]);

const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  privyUserId: text("privy_user_id").notNull().unique(),
});

const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  name: text("name").notNull(),
});

const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  agentId: uuid("agent_id"),
  category: auditLogCategoryEnum("category").notNull(),
  action: text("action").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  status: text("status").notNull().default("success"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

const SAMPLE_LOGS = [
  {
    category: "agent",
    action: "agent_created",
    description: "New agent 'Sales Assistant' was created",
    status: "success",
    metadata: { agentType: "sales", template: "sales-outreach" },
  },
  {
    category: "communication",
    action: "email_sent",
    description: "Follow-up email sent to lead: john@example.com",
    status: "success",
    metadata: {
      recipient: "john@example.com",
      subject: "Following up on our conversation",
      templateId: "follow-up-v2",
    },
  },
  {
    category: "communication",
    action: "email_sent",
    description: "Welcome email sent to new subscriber",
    status: "success",
    metadata: {
      recipient: "sarah@company.co",
      subject: "Welcome to Aura!",
    },
  },
  {
    category: "calendar",
    action: "meeting_booked",
    description: "Demo meeting scheduled with Acme Corp",
    status: "success",
    metadata: {
      attendees: ["demo@acme.com", "sales@company.com"],
      duration: "30min",
      platform: "Google Meet",
    },
  },
  {
    category: "pipeline",
    action: "lead_qualified",
    description: "Lead moved to qualified stage after engagement score reached threshold",
    status: "success",
    metadata: {
      leadId: "lead_123",
      previousStage: "new",
      newStage: "qualified",
      engagementScore: 85,
    },
  },
  {
    category: "integration",
    action: "crm_updated",
    description: "Contact record updated in Salesforce",
    status: "success",
    metadata: {
      crmProvider: "salesforce",
      recordId: "003xx000004TmiU",
      fieldsUpdated: ["last_contacted", "engagement_score"],
    },
  },
  {
    category: "integration",
    action: "slack_notification",
    description: "New lead alert posted to #sales-leads channel",
    status: "success",
    metadata: {
      channel: "#sales-leads",
      messageType: "new_lead_alert",
    },
  },
  {
    category: "communication",
    action: "email_bounced",
    description: "Email delivery failed - invalid recipient address",
    status: "failure",
    metadata: {
      recipient: "invalid@nonexistent.xyz",
      bounceType: "hard",
      errorCode: "550",
    },
  },
  {
    category: "system",
    action: "rate_limit_exceeded",
    description: "API rate limit reached for email provider",
    status: "failure",
    metadata: {
      provider: "sendgrid",
      limitType: "daily",
      currentUsage: 10000,
      limit: 10000,
    },
  },
  {
    category: "agent",
    action: "heartbeat_executed",
    description: "Scheduled heartbeat completed successfully",
    status: "success",
    metadata: {
      duration: "2.3s",
      tasksCompleted: 5,
      nextRun: "2024-01-15T10:00:00Z",
    },
  },
  {
    category: "billing",
    action: "subscription_renewed",
    description: "Monthly subscription renewed successfully",
    status: "success",
    metadata: {
      plan: "pro",
      amount: 49.0,
      currency: "USD",
      nextBillingDate: "2024-02-15",
    },
  },
  {
    category: "calendar",
    action: "meeting_rescheduled",
    description: "Client meeting rescheduled to next week",
    status: "success",
    metadata: {
      originalDate: "2024-01-15T14:00:00Z",
      newDate: "2024-01-22T14:00:00Z",
      reason: "Client requested",
    },
  },
  {
    category: "pipeline",
    action: "deal_closed",
    description: "Deal closed with TechStart Inc - $15,000 ARR",
    status: "success",
    metadata: {
      dealId: "deal_456",
      company: "TechStart Inc",
      value: 15000,
      currency: "USD",
      closeReason: "won",
    },
  },
  {
    category: "agent",
    action: "agent_paused",
    description: "Agent paused due to consecutive failures",
    status: "pending",
    metadata: {
      failureCount: 3,
      lastError: "API timeout",
      autoResumeAt: "2024-01-15T12:00:00Z",
    },
  },
  {
    category: "integration",
    action: "webhook_received",
    description: "Incoming webhook from Stripe processed",
    status: "success",
    metadata: {
      eventType: "invoice.paid",
      webhookId: "wh_123abc",
    },
  },
];

async function seedAuditLogs() {
  console.log("🌱 Seeding audit logs...");

  // Get the first user
  const userResults = await db.select().from(users).limit(1);
  const user = userResults[0];
  
  if (!user) {
    console.log("❌ No users found. Please create a user first by logging in.");
    process.exit(1);
  }

  console.log(`👤 Found user: ${user.id}`);

  // Get user's first agent (optional)
  const agentResults = await db
    .select()
    .from(agents)
    .where(eq(agents.userId, user.id))
    .limit(1);
  const agent = agentResults[0];

  if (agent) {
    console.log(`🤖 Found agent: ${agent.name}`);
  }

  // Clear existing audit logs for this user
  await db.delete(auditLogs).where(eq(auditLogs.userId, user.id));
  console.log("🗑️  Cleared existing audit logs");

  // Create sample logs with varying timestamps
  const now = new Date();
  const logsToInsert = SAMPLE_LOGS.map((log, index) => {
    // Spread logs over the past week
    const createdAt = new Date(
      now.getTime() - index * 3600000 * (1 + Math.random() * 6)
    );

    return {
      userId: user.id,
      agentId: ["agent", "communication", "calendar"].includes(log.category)
        ? agent?.id || null
        : null,
      category: log.category,
      action: log.action,
      description: log.description,
      status: log.status,
      metadata: log.metadata,
      ipAddress: "192.168.1." + Math.floor(Math.random() * 255),
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      createdAt,
    };
  });

  await db.insert(auditLogs).values(logsToInsert);

  console.log(`✅ Seeded ${logsToInsert.length} audit log entries`);
}

seedAuditLogs().catch(console.error);
