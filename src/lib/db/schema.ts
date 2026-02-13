import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
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
