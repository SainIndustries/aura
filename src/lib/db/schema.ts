import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const templateCategoryEnum = pgEnum("template_category", [
  "operations",
  "engineering",
  "communications",
  "sales",
  "marketing",
  "support",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
]);

export const agentStatusEnum = pgEnum("agent_status", [
  "draft",
  "active",
  "paused",
  "error",
]);

export const channelTypeEnum = pgEnum("channel_type", [
  "web",
  "slack",
  "telegram",
  "whatsapp",
  "discord",
  "email",
  "phone",
]);

export const auditLogCategoryEnum = pgEnum("audit_log_category", [
  "agent",
  "communication",
  "calendar",
  "pipeline",
  "integration",
  "system",
  "billing",
]);

export const provisioningStatusEnum = pgEnum("provisioning_status", [
  "pending",
  "provisioning",
  "running",
  "stopping",
  "stopped",
  "failed",
]);

export const teamRoleEnum = pgEnum("team_role", [
  "owner",
  "admin",
  "member",
  "viewer",
]);

export const teamInviteStatusEnum = pgEnum("team_invite_status", [
  "pending",
  "accepted",
  "expired",
  "revoked",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  privyUserId: text("privy_user_id").notNull().unique(),
  email: text("email"),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripePriceId: text("stripe_price_id"),
  status: subscriptionStatusEnum("status").notNull().default("trialing"),
  currentPeriodStart: timestamp("current_period_start", {
    withTimezone: true,
  }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  trialEnd: timestamp("trial_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: agentStatusEnum("status").notNull().default("draft"),
  personality: text("personality"),
  goal: text("goal"),
  heartbeatCron: text("heartbeat_cron"),
  heartbeatEnabled: boolean("heartbeat_enabled").default(false),
  integrations: jsonb("integrations").$type<Record<string, unknown>>(),
  config: jsonb("config").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  type: channelTypeEnum("type").notNull(),
  name: text("name").notNull(),
  enabled: boolean("enabled").default(true),
  config: jsonb("config").$type<Record<string, unknown>>(),
  connectedAt: timestamp("connected_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const teamMembers = pgTable("team_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  workspaceOwnerId: uuid("workspace_owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  role: teamRoleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const teamInvites = pgTable("team_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceOwnerId: uuid("workspace_owner_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull(),
  role: teamRoleEnum("role").notNull().default("member"),
  status: teamInviteStatusEnum("status").notNull().default("pending"),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const integrations = pgTable("integrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  provider: text("provider").notNull(), // 'google', 'slack', 'github', etc.
  accessToken: text("access_token"), // encrypted
  refreshToken: text("refresh_token"), // encrypted
  tokenExpiry: timestamp("token_expiry", { withTimezone: true }),
  scopes: text("scopes").array(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  connectedAt: timestamp("connected_at", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const voiceSettings = pgTable("voice_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  elevenlabsVoiceId: text("elevenlabs_voice_id"),
  elevenlabsModelId: text("elevenlabs_model_id"),
  twilioPhoneNumber: text("twilio_phone_number"),
  callHandlingEnabled: boolean("call_handling_enabled").default(false),
  voicemailEnabled: boolean("voicemail_enabled").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const agentInstances = pgTable("agent_instances", {
  id: uuid("id").defaultRandom().primaryKey(),
  agentId: uuid("agent_id")
    .references(() => agents.id, { onDelete: "cascade" })
    .notNull(),
  status: provisioningStatusEnum("status").notNull().default("pending"),
  serverId: text("server_id"), // Hetzner server ID when provisioned
  serverIp: text("server_ip"),
  tailscaleIp: text("tailscale_ip"),
  region: text("region").default("us-east"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  agents: many(agents),
  integrations: many(integrations),
  channels: many(channels),
  teamMemberships: many(teamMembers, { relationName: "memberUser" }),
  ownedTeamMembers: many(teamMembers, { relationName: "workspaceOwner" }),
  ownedTeamInvites: many(teamInvites),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  channels: many(channels),
  instances: many(agentInstances),
}));

export const agentInstancesRelations = relations(agentInstances, ({ one }) => ({
  agent: one(agents, {
    fields: [agentInstances.agentId],
    references: [agents.id],
  }),
}));

export const voiceSettingsRelations = relations(voiceSettings, ({ one }) => ({
  user: one(users, {
    fields: [voiceSettings.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [voiceSettings.agentId],
    references: [agents.id],
  }),
}));

export const channelsRelations = relations(channels, ({ one }) => ({
  user: one(users, {
    fields: [channels.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [channels.agentId],
    references: [agents.id],
  }),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  user: one(users, {
    fields: [integrations.userId],
    references: [users.id],
  }),
}));

export const agentTemplates = pgTable("agent_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: templateCategoryEnum("category").notNull(),
  icon: text("icon").notNull(),
  personality: text("personality"),
  goal: text("goal"),
  heartbeatCron: text("heartbeat_cron"),
  heartbeatEnabled: boolean("heartbeat_enabled").default(true),
  integrations: text("integrations").array(),
  config: jsonb("config").$type<Record<string, unknown>>(),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  category: auditLogCategoryEnum("category").notNull(),
  action: text("action").notNull(), // 'email_sent', 'meeting_booked', 'crm_updated', etc.
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  status: text("status").notNull().default("success"), // 'success', 'failure', 'pending'
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [auditLogs.agentId],
    references: [agents.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
    relationName: "memberUser",
  }),
  workspaceOwner: one(users, {
    fields: [teamMembers.workspaceOwnerId],
    references: [users.id],
    relationName: "workspaceOwner",
  }),
}));

export const teamInvitesRelations = relations(teamInvites, ({ one }) => ({
  workspaceOwner: one(users, {
    fields: [teamInvites.workspaceOwnerId],
    references: [users.id],
  }),
}));

// Call Logs for Phone Channel
export const callLogs = pgTable("call_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  channelId: uuid("channel_id").references(() => channels.id, { onDelete: "set null" }),
  twilioCallSid: text("twilio_call_sid").notNull(),
  direction: text("direction").notNull(), // "inbound" | "outbound"
  fromNumber: text("from_number").notNull(),
  toNumber: text("to_number").notNull(),
  status: text("status").notNull(), // "queued", "ringing", "in-progress", "completed", "failed", "busy", "no-answer"
  duration: integer("duration"), // seconds
  recordingUrl: text("recording_url"),
  recordingSid: text("recording_sid"),
  transcription: text("transcription"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const callLogsRelations = relations(callLogs, ({ one }) => ({
  user: one(users, {
    fields: [callLogs.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [callLogs.agentId],
    references: [agents.id],
  }),
  channel: one(channels, {
    fields: [callLogs.channelId],
    references: [channels.id],
  }),
}));

// Token Balances — tracks per-user token allocation and usage
export const tokenBalances = pgTable("token_balances", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  balance: integer("balance").notNull().default(0),
  monthlyAllocation: integer("monthly_allocation").notNull().default(10_000_000),
  totalUsed: integer("total_used").notNull().default(0),
  totalPurchased: integer("total_purchased").notNull().default(0),
  lastResetAt: timestamp("last_reset_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tokenBalancesRelations = relations(tokenBalances, ({ one }) => ({
  user: one(users, {
    fields: [tokenBalances.userId],
    references: [users.id],
  }),
}));

// Token Top-Ups — records of purchased token packs
export const tokenTopUps = pgTable("token_top_ups", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  stripeSessionId: text("stripe_session_id"),
  tokensAdded: integer("tokens_added").notNull(),
  amountPaid: integer("amount_paid").notNull(), // cents
  packageId: text("package_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tokenTopUpsRelations = relations(tokenTopUps, ({ one }) => ({
  user: one(users, {
    fields: [tokenTopUps.userId],
    references: [users.id],
  }),
}));

// Waitlist enum for deployment preference
export const deploymentPreferenceEnum = pgEnum("deployment_preference", [
  "cloud",
  "local",
  "undecided",
]);

// Waitlist
export const waitlist = pgTable("waitlist", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  useCase: text("use_case").notNull(),
  city: text("city").notNull(),
  deploymentPreference: deploymentPreferenceEnum("deployment_preference").notNull().default("undecided"),
  company: text("company"),
  notes: text("notes"),
  contacted: boolean("contacted").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
