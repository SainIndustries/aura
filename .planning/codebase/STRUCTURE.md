# Codebase Structure

**Analysis Date:** 2026-02-13

## Directory Layout

```
aura/
├── src/
│   ├── app/                           # Next.js App Router root
│   │   ├── (auth)/                    # Auth layout group
│   │   │   └── sign-in/
│   │   │       └── page.tsx           # Privy login page
│   │   ├── (dashboard)/               # Protected dashboard layout group
│   │   │   ├── agents/                # Agent management pages
│   │   │   ├── chat/                  # Chat interface
│   │   │   ├── integrations/          # Integration management
│   │   │   ├── channels/              # Channel configuration
│   │   │   ├── templates/             # Agent templates
│   │   │   ├── team/                  # Team management
│   │   │   ├── settings/              # User settings
│   │   │   ├── audit-log/             # Audit trail
│   │   │   └── onboarding/            # Onboarding flow
│   │   ├── (marketing)/               # Public marketing pages
│   │   │   ├── privacy/
│   │   │   └── terms/
│   │   ├── api/                       # REST API routes (110 handlers)
│   │   │   ├── agents/                # Agent CRUD and operations
│   │   │   │   └── [id]/
│   │   │   │       ├── provision/     # Provision agent to infrastructure
│   │   │   │       ├── start/         # Start agent instance
│   │   │   │       ├── stop/          # Stop agent instance
│   │   │   │       ├── instance/      # Get instance status
│   │   │   │       └── logs/          # Get agent logs
│   │   │   ├── integrations/          # 50+ integration handlers
│   │   │   │   ├── slack/
│   │   │   │   ├── google/
│   │   │   │   ├── github/
│   │   │   │   └── [50+ more]/
│   │   │   ├── auth/
│   │   │   │   └── sync/              # Sync Privy user to database
│   │   │   ├── channels/              # Channel configuration
│   │   │   ├── chat/                  # Chat endpoint
│   │   │   ├── team/                  # Team CRUD
│   │   │   │   └── invites/           # Team invite handling
│   │   │   ├── audit-log/             # Audit log retrieval
│   │   │   ├── voice-settings/        # Voice configuration
│   │   │   ├── webhooks/              # Webhook receivers
│   │   │   │   ├── stripe/            # Stripe billing webhooks
│   │   │   │   └── twilio/            # Twilio call webhooks
│   │   │   └── waitlist/              # Public waitlist endpoint
│   │   ├── layout.tsx                 # Root layout with providers
│   │   ├── globals.css                # Global Tailwind styles
│   │   ├── global-error.tsx           # Global error boundary
│   │   └── page.tsx                   # Home page (if exists)
│   ├── components/                    # React components
│   │   ├── ui/                        # shadcn UI primitives
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── [other primitives]/
│   │   ├── dashboard/                 # Dashboard feature components
│   │   │   ├── agent-card.tsx
│   │   │   ├── agent-edit-form.tsx
│   │   │   ├── agent-status-toggle.tsx
│   │   │   ├── provisioning-status.tsx
│   │   │   ├── audit-log-table.tsx
│   │   │   ├── team-member-card.tsx
│   │   │   ├── invite-member-dialog.tsx
│   │   │   ├── integration-detail.tsx
│   │   │   ├── template-card.tsx
│   │   │   ├── delete-agent-button-client.tsx
│   │   │   └── agent-wizard/          # Multi-step agent creation
│   │   ├── auth/                      # Auth components
│   │   │   └── auth-guard.tsx
│   │   ├── layout/                    # Layout components
│   │   │   └── [shared layouts]/
│   │   ├── marketing/                 # Marketing page components
│   │   ├── providers/                 # Context providers
│   │   │   ├── privy-provider.tsx     # Privy auth provider
│   │   │   └── theme-provider.tsx     # Theme context
│   │   └── __tests__/                 # Component tests
│   ├── lib/                           # Shared utilities and business logic
│   │   ├── db/                        # Database layer
│   │   │   ├── index.ts               # Drizzle client initialization
│   │   │   ├── schema.ts              # Table definitions and enums
│   │   │   └── user-sync.ts           # User upsert logic
│   │   ├── auth/                      # Auth utilities
│   │   │   └── current-user.ts        # Get current authenticated user
│   │   ├── integrations/              # Integration utilities
│   │   │   ├── index.ts               # Barrel export
│   │   │   ├── oauth-state.ts         # CSRF state generation/validation
│   │   │   ├── token-refresh.ts       # OAuth token refresh logic
│   │   │   ├── encryption.ts          # Token encryption/decryption
│   │   │   └── providers.tsx          # Provider definitions (categories, metadata)
│   │   ├── provisioning/              # Agent deployment logic
│   │   │   ├── index.ts               # Queue, status, and steps management
│   │   │   └── simulator.ts           # Simulated provisioning steps
│   │   ├── validators/                # Zod schemas
│   │   │   └── agent.ts               # Agent creation validation
│   │   ├── actions/                   # Server actions
│   │   │   └── stripe.ts              # Stripe-related mutations
│   │   ├── data/                      # Data fetching (if any)
│   │   ├── privy.ts                   # Privy client singleton
│   │   ├── stripe.ts                  # Stripe client initialization
│   │   ├── subscription.ts            # Subscription utilities
│   │   ├── email.ts                   # Resend email client
│   │   ├── rate-limit.ts              # Upstash rate limiting
│   │   ├── dashboard-stats.ts         # Dashboard statistics queries
│   │   ├── utils.ts                   # Utility functions (cn for Tailwind)
│   │   └── __tests__/                 # Library tests
│   ├── hooks/                         # React hooks
│   │   ├── use-user-sync.ts           # Auto-sync Privy user to database
│   │   └── use-mobile.ts              # Detect mobile viewport
│   ├── test/                          # Test utilities
│   ├── middleware.ts                  # Next.js middleware (auth check)
│   └── instrumentation.ts             # Sentry instrumentation
├── public/                            # Static assets
│   ├── logo.svg
│   ├── favicon.svg
│   ├── og-image.png
│   └── [other assets]/
├── drizzle/                           # Drizzle ORM migrations
├── e2e/                               # Playwright E2E tests
├── scripts/                           # Build/dev scripts
├── references/                        # Documentation/reference files
├── sentry.client.config.ts            # Sentry client-side config
├── sentry.server.config.ts            # Sentry server-side config
├── sentry.edge.config.ts              # Sentry edge runtime config
├── tsconfig.json                      # TypeScript configuration
├── next.config.ts                     # Next.js configuration (Sentry integration)
├── drizzle.config.ts                  # Drizzle ORM configuration
├── vitest.config.ts                   # Unit test configuration
├── playwright.config.ts               # E2E test configuration
├── eslint.config.mjs                  # ESLint rules
├── postcss.config.mjs                 # PostCSS plugins
├── components.json                    # shadcn component registry
├── package.json                       # Dependencies
├── vercel.json                        # Vercel deployment config
└── README.md                          # Project overview
```

## Directory Purposes

**src/app:**
- Purpose: Next.js App Router application structure
- Contains: Page components, layouts, API routes
- Key files: `layout.tsx` (root setup), `global-error.tsx` (error boundary)

**src/app/api:**
- Purpose: Backend API endpoints
- Contains: 110 route handlers organized by domain
- Key structure: Each domain has `route.ts` for main handler, subdirectories for nested resources

**src/app/(dashboard):**
- Purpose: Protected authenticated pages
- Contains: Agent management, integrations, chat, team, settings
- Pattern: Route groups use parentheses `()` to avoid URL segments

**src/components/ui:**
- Purpose: Reusable UI primitives from shadcn
- Contains: Button, Card, Badge, DropdownMenu, Sidebar, etc.
- Pattern: Copy-paste components from shadcn registry

**src/components/dashboard:**
- Purpose: Feature-specific business components
- Contains: Agent cards, forms, dialogs, status displays
- Pattern: Client components marked with `"use client"`

**src/lib/db:**
- Purpose: Database access layer
- Contains: Drizzle client, schema, user operations
- Key files: `schema.ts` (all table definitions), `index.ts` (client export)

**src/lib/integrations:**
- Purpose: External service integration utilities
- Contains: OAuth flows, token management, provider metadata
- Key patterns: `encryptToken`/`decryptToken` for sensitive data, `oauth-state` for CSRF protection

**src/lib/provisioning:**
- Purpose: Agent deployment and infrastructure management
- Contains: Provisioning queue, status tracking, step simulation
- Pattern: Maps agent deployment lifecycle to user-facing progress steps

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML structure, providers (Privy, Sonner), fonts, metadata
- `src/middleware.ts`: Authentication check on protected routes
- `src/app/(auth)/sign-in/page.tsx`: Login page with Privy modal

**Configuration:**
- `tsconfig.json`: TypeScript settings, path alias `@/*` → `src/*`
- `next.config.ts`: Sentry integration, Next.js optimization
- `drizzle.config.ts`: Database connection and migration settings
- `vitest.config.ts`: Unit test runner configuration
- `components.json`: shadcn registry for component copy-paste

**Core Logic:**
- `src/lib/auth/current-user.ts`: Fetch authenticated user from Privy token
- `src/lib/db/user-sync.ts`: Upsert user after OAuth
- `src/lib/integrations/oauth-state.ts`: Generate/validate CSRF state cookies
- `src/lib/provisioning/index.ts`: Queue agent provisioning, track status

## Naming Conventions

**Files:**
- `page.tsx`: Route component in Next.js App Router
- `layout.tsx`: Layout wrapper for routes in directory
- `route.ts`: API handler (supports GET, POST, PUT, DELETE, etc.)
- `[id].tsx` or `[id]/page.tsx`: Dynamic route segment
- `component-name.tsx`: React component files use kebab-case
- `use-*.ts`: Custom React hooks
- `*.schema.ts`: Zod validation schemas
- `*.config.ts`: Configuration files

**Directories:**
- `(group-name)`: Route group—segments in parentheses don't affect URL
- `api/`: API routes directory
- `integrations/`: Integration-specific subdirectories follow provider name (e.g., `slack`, `github`)
- `[param]/`: Dynamic segment directories

**Functions:**
- camelCase for all JavaScript functions and variables
- PascalCase for React components and types
- UPPERCASE for constants
- Prefix with `get`, `set`, `use`, `is`, `validate` for clarity (e.g., `getCurrentUser`, `generateState`, `validateState`)

**Types:**
- PascalCase for interfaces and types
- Suffix with `Props` for component props (e.g., `AgentCardProps`)
- Suffix with `Schema` for Zod schemas (e.g., `createAgentSchema`)
- Suffix with `Data` for data transfer objects (e.g., `CreateAgentData`)

## Where to Add New Code

**New Feature:**
- Primary code: `src/app/api/[domain]/route.ts` (API), `src/app/(dashboard)/[feature]/page.tsx` (UI)
- Components: `src/components/dashboard/[feature-name].tsx`
- Tests: Colocate with API routes in `__tests__/` or separately in test directories
- Validators: `src/lib/validators/[domain].ts`
- Utilities: `src/lib/[domain]/index.ts` or `src/lib/[domain]/[utility].ts`

**New Integration:**
- API handler: `src/app/api/integrations/[service-name]/route.ts`
- OAuth callback: `src/app/api/integrations/[service-name]/callback/route.ts`
- Provider metadata: Add to `src/lib/integrations/providers.tsx`
- Tests: `src/app/api/integrations/[service-name]/__tests__/route.test.ts`

**New Component:**
- Reusable/global: `src/components/[category]/component-name.tsx`
- Dashboard feature: `src/components/dashboard/component-name.tsx`
- UI primitives: `src/components/ui/component-name.tsx` (from shadcn)
- Tests: `src/components/__tests__/component-name.test.tsx`

**Utilities:**
- Auth: `src/lib/auth/[utility].ts`
- Database: `src/lib/db/[utility].ts`
- Data validation: `src/lib/validators/[domain].ts`
- Shared helpers: `src/lib/utils.ts`

## Special Directories

**public/:**
- Purpose: Static assets served by Next.js
- Generated: No
- Committed: Yes
- Contents: Logo, favicon, OG images, site manifest

**drizzle/:**
- Purpose: Drizzle ORM migration files
- Generated: Yes (via `npm run db:generate`)
- Committed: Yes
- Usage: Track schema changes for database versioning

**e2e/:**
- Purpose: Playwright end-to-end tests
- Generated: No (written manually)
- Committed: Yes
- Run: `npm run test:e2e`

**.next/:**
- Purpose: Next.js build output
- Generated: Yes (via `npm run build`)
- Committed: No (in .gitignore)
- Contains: Compiled JavaScript, static assets, server functions

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes (via `npm install`)
- Committed: No (in .gitignore)
- Managed by: package-lock.json

---

*Structure analysis: 2026-02-13*
