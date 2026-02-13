# Architecture

**Analysis Date:** 2026-02-13

## Pattern Overview

**Overall:** Layered Full-Stack Next.js Application with Multi-Integration Ecosystem

**Key Characteristics:**
- Next.js 16 App Router with file-based routing
- API routes as backend layer (`/src/app/api`)
- React 19 with client/server component separation
- Modular integration system supporting 50+ external services
- Privy-based authentication with wallet support
- Drizzle ORM for PostgreSQL data access
- Agent provisioning and management system
- Streaming webhook architecture for third-party callbacks

## Layers

**Presentation Layer:**
- Purpose: User-facing UI components and pages
- Location: `src/app/(dashboard)`, `src/app/(auth)`, `src/app/(marketing)`, `src/components`
- Contains: Page components, layout components, UI primitives (shadcn), dashboard views
- Depends on: Client hooks, utility functions, TailwindCSS, Sonner for toasts
- Used by: Browser clients via Next.js

**API Layer:**
- Purpose: RESTful endpoints handling business logic and external service integration
- Location: `src/app/api`
- Contains: 110+ route handlers organized by domain (agents, integrations, auth, webhooks, chat, team, audit-log)
- Depends on: Database layer, auth utilities, Privy client, validation schemas
- Used by: Frontend, webhooks from external services

**Business Logic Layer:**
- Purpose: Core application functionality and service integrations
- Location: `src/lib` (actions, provisioning, validators, integrations)
- Contains: User sync logic, agent provisioning, OAuth utilities, token encryption, validation schemas
- Depends on: Database layer, external APIs, encryption utilities
- Used by: API routes, server components

**Data Layer:**
- Purpose: Database access and schema definitions
- Location: `src/lib/db`
- Contains: Drizzle ORM client, schema definitions, user sync operations
- Depends on: Neon serverless PostgreSQL driver
- Used by: All business logic and API routes

**Integration Layer:**
- Purpose: Abstract external service interactions (OAuth, APIs, webhooks)
- Location: `src/lib/integrations`, `src/app/api/integrations`
- Contains: OAuth state management, token encryption/refresh, provider definitions, callback handlers for 50+ services
- Depends on: Database, encryption utilities
- Used by: API routes for OAuth flows and webhook handling

## Data Flow

**User Authentication Flow:**
1. User visits `/sign-in` → Privy login modal (email, Google, GitHub, SMS, passkey)
2. Privy sets `privy-token` cookie after successful auth
3. Middleware (`src/middleware.ts`) validates token for protected routes
4. Client calls `/api/auth/sync` via `useUserSync()` hook
5. Server verifies token with Privy client, syncs user data to database
6. User redirected to `/dashboard`

**Agent Management Flow:**
1. User creates agent via `/agents/new` page
2. Form validates with `createAgentSchema` (Zod)
3. POST `/api/agents` saves agent to database
4. User provisions agent via POST `/api/agents/[id]/provision`
5. Provisioning queues job and simulates deployment steps
6. Client polls status from GET `/api/agents/[id]/instance`
7. User can start/stop agent via webhooks on `[id]/start` and `[id]/stop` routes

**OAuth Integration Flow:**
1. User clicks "Connect [Service]" on integrations page
2. API endpoint (e.g., `/api/integrations/slack/route.ts`) generates OAuth state
3. State stored in encrypted cookie, user redirected to OAuth provider
4. Provider redirects back to `/api/integrations/[service]/callback`
5. Callback handler validates state, exchanges code for token
6. Token encrypted and stored in database with integration record
7. Client refreshes to show connected status

**Webhook Handling Flow:**
1. External services (Stripe, Twilio) send webhooks to `/api/webhooks/[service]`
2. Routes verify webhook signatures (Stripe, Twilio validation)
3. Process event and update database state
4. Respond with 200 OK

**State Management:**
- **Authentication:** Privy client state + Next.js cookies
- **User Data:** Database (PostgreSQL via Drizzle)
- **UI State:** React hooks (useState) in client components
- **Integration State:** Database records encrypted with sensitive tokens

## Key Abstractions

**Agent:**
- Purpose: AI assistant configured by user with specific instructions and capabilities
- Examples: `src/app/api/agents/route.ts`, `src/components/dashboard/agent-card.tsx`
- Pattern: Stored in `agents` table with status lifecycle (draft → active → paused/error)

**Integration:**
- Purpose: Connected third-party service with OAuth tokens and configuration
- Examples: `src/app/api/integrations/slack/callback/route.ts`, `src/lib/integrations/providers.tsx`
- Pattern: Each integration has OAuth handler, token management, and state preservation

**AgentInstance:**
- Purpose: Running deployment of an agent in a provisioned container/VM
- Examples: `src/lib/provisioning/index.ts`, `src/app/api/agents/[id]/provision/route.ts`
- Pattern: Tracks provisioning lifecycle with status (pending → running → stopped)

**Channel:**
- Purpose: Communication medium where agent can receive/send messages
- Examples: Web, Slack, Telegram, WhatsApp, Discord, Email, Phone
- Pattern: Defined in schema with `channelTypeEnum`, routed to agent via webhooks

**AuditLog:**
- Purpose: Track all significant user actions for compliance
- Examples: Agent creation, integration connections, team member changes
- Pattern: Immutable records with category and timestamp

**Subscription:**
- Purpose: Stripe billing relationship for users
- Pattern: Links to Stripe customer and subscription IDs for webhook processing

## Entry Points

**Web Application Root:**
- Location: `src/app/layout.tsx`
- Triggers: Browser navigation to any URL
- Responsibilities: Set up root providers (PrivyProvider), configure global styles, fonts, metadata

**API Routes:**
- Location: `src/app/api/[domain]/route.ts` (110 total)
- Triggers: HTTP requests from frontend or external webhooks
- Responsibilities: Validate user authentication, authorize access, process business logic, return JSON responses

**Middleware:**
- Location: `src/middleware.ts`
- Triggers: Every request matching configured paths
- Responsibilities: Validate `privy-token` cookie on protected routes, redirect unauthenticated users to `/sign-in`

**Sign In Page:**
- Location: `src/app/(auth)/sign-in/page.tsx`
- Triggers: Unauthenticated users visiting protected routes
- Responsibilities: Render Privy login modal, redirect authenticated users to dashboard

**Dashboard:**
- Location: `src/app/(dashboard)/dashboard/page.tsx`
- Triggers: Authenticated users navigating to `/dashboard`
- Responsibilities: Display user overview, agent list, quick actions

## Error Handling

**Strategy:** Try-catch blocks with NextResponse error returns, console logging for debugging

**Patterns:**
- API routes catch exceptions and return `NextResponse.json({ error: "..." }, { status: 500 })`
- Missing resources return 404 with "Not found" message
- Authentication failures return 401 with "Not authenticated" message
- Authorization failures check resource ownership before 404 response
- Validation errors handled by Zod schema inference
- Privy token verification wrapped in try-catch with null return on failure

## Cross-Cutting Concerns

**Logging:** Console-based, primarily for errors and debugging (appears in Sentry config)

**Validation:** Zod schemas at API entry points and form submission (e.g., `createAgentSchema` in `src/lib/validators/agent.ts`)

**Authentication:** Privy client for token verification, Privy cookies for session, custom `getCurrentUser()` for protected endpoints

**Rate Limiting:** Upstash Redis integration configured in `src/lib/rate-limit.ts`

**Error Tracking:** Sentry integration configured in `next.config.ts`, `src/sentry.*.config.ts` files

**Email:** Resend SDK for transactional emails (imported but usage in `src/lib/email.ts`)

---

*Architecture analysis: 2026-02-13*
