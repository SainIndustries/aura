# External Integrations

**Analysis Date:** 2026-02-13

## APIs & External Services

**AI/LLM:**
- OpenAI (ChatGPT API) - Chat completions for Aura AI assistant
  - SDK/Client: `openai` package (6.21.0)
  - Model: gpt-4o-mini
  - Auth: `OPENAI_API_KEY` env var
  - Implementation: `src/app/api/chat/route.ts` - Conversational AI for user interactions

**Email Delivery:**
- Resend - Transactional email service
  - SDK/Client: `resend` package (6.9.2)
  - Auth: `RESEND_API_KEY` env var
  - Implementation: `src/lib/email.ts` with pre-built templates
  - Templates: Welcome, team invite, subscription confirmation
  - From address: `AURA <noreply@moreaura.ai>` (configurable via `FROM_EMAIL`)

**Payment Processing:**
- Stripe - Payment platform and subscription management
  - SDK/Client: `stripe` package (20.3.1)
  - Auth: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` env vars
  - Webhook: `/api/webhooks/stripe` handles checkout sessions, subscription updates, invoice events
  - Implementation: `src/lib/stripe.ts` (singleton pattern)
  - Database sync: `src/app/api/webhooks/stripe/route.ts` syncs subscriptions to database

**Rate Limiting & Caching:**
- Upstash Redis - Distributed Redis for rate limiting
  - SDK/Client: `@upstash/redis` (1.36.2), `@upstash/ratelimit` (2.0.8)
  - Auth: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` env vars
  - Endpoints: REST API over HTTP (no TCP required)
  - Implementation: `src/lib/rate-limit.ts`
    - General rate limit: 10 requests/10 seconds (configurable)
    - Auth rate limit: 5 requests/60 seconds (stricter)
    - Graceful fallback if Redis not configured

## Data Storage

**Databases:**
- PostgreSQL (Neon Serverless)
  - Connection: `DATABASE_URL` env var (serverless HTTP driver)
  - Client: Drizzle ORM via `@neondatabase/serverless` (HTTP-based, no TCP)
  - Schema: `src/lib/db/schema.ts`
  - Migrations: `drizzle/` directory (Drizzle Kit)
  - ORM: Drizzle ORM (0.45.1) for type-safe queries

**File Storage:**
- Local filesystem only - No explicit S3/cloud storage detected

**Caching:**
- Upstash Redis - Distributed cache for rate limits and session state

## Authentication & Identity

**Auth Provider:**
- Privy - Web3 and traditional authentication
  - Client SDK: `@privy-io/react-auth` (3.13.1)
  - Server SDK: `@privy-io/server-auth` (1.32.5)
  - Auth: `NEXT_PUBLIC_PRIVY_APP_ID` (public), `PRIVY_APP_SECRET` (secret)
  - Implementation:
    - `src/components/providers/privy-provider.tsx` - Client-side provider
    - `src/lib/privy.ts` - Server-side Privy client (singleton)
    - `src/app/api/auth/sync/route.ts` - User sync endpoint
    - `src/lib/db/user-sync.ts` - User upsert logic
  - Token verification: `privy.verifyAuthToken(token)` from cookie `privy-token`
  - User retrieval: `privy.getUser(userId)` for profile data

## Monitoring & Observability

**Error Tracking:**
- Sentry - Error tracking and performance monitoring
  - SDK: `@sentry/nextjs` (10.38.0)
  - DSN: `NEXT_PUBLIC_SENTRY_DSN` env var
  - Org: sain-industries
  - Project: aura
  - Implementation:
    - `sentry.server.config.ts` - Server-side configuration
    - `sentry.client.config.ts` - Client-side configuration
    - `sentry.edge.config.ts` - Edge runtime configuration
  - Features: Source map upload, performance tracing (tracesSampleRate: 1.0)

**Analytics:**
- Google Analytics - Website analytics
  - Integration: `@next/third-parties/google` (16.1.6)
  - Measurement ID: `NEXT_PUBLIC_GA_MEASUREMENT_ID` env var
  - Implementation: `src/app/layout.tsx` - GoogleAnalytics component

**Logs:**
- Console logging (standard Node.js/browser console)
- Sentry for error log aggregation

## CI/CD & Deployment

**Hosting:**
- Vercel - Next.js deployment platform (inferred from next.config.ts integration with Sentry Vercel plugin)

**CI Pipeline:**
- Not detected in configuration files

## Environment Configuration

**Required env vars (critical):**
- `DATABASE_URL` - PostgreSQL connection
- `OPENAI_API_KEY` - AI features
- `PRIVY_APP_SECRET` - Authentication
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payments
- `RESEND_API_KEY` - Email
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` - Rate limiting

**Optional env vars:**
- `UPSTASH_REDIS_*` - Rate limiting (graceful no-op if missing)
- `RESEND_API_KEY` - Email (fallback logs warning)
- `OPENAI_API_KEY` - AI (fallback responses used)
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Analytics
- `NEXT_PUBLIC_SENTRY_DSN` - Error tracking
- `CI` - CI environment flag (affects Sentry logging verbosity)

**Secrets location:**
- `.env.local` file (not committed, in `.gitignore`)
- Must be configured per environment (development, staging, production)

## OAuth Integrations

The platform supports 50+ OAuth integrations for third-party services. Core infrastructure:

**OAuth Implementation:**
- State validation: `src/lib/integrations/oauth-state.ts` - CSRF protection using state parameter
- Token encryption: `src/lib/integrations/encryption.ts` - Tokens encrypted before database storage
- Token refresh: `src/lib/integrations/token-refresh.ts` - Automatic refresh of expired tokens
- Provider metadata: `src/lib/integrations/providers.tsx` - 50+ integration definitions

**OAuth Flow Pattern:**
1. GET `/api/integrations/[provider]/route.ts` - Redirect to OAuth provider authorization URL
2. POST/GET `/api/integrations/[provider]/callback/route.ts` - Exchange code for tokens, store encrypted
3. Database: `src/lib/db/schema.ts` → `integrations` table stores encrypted tokens per user

**Supported Integrations by Category:**

**Communication (Slack, Discord, Microsoft Teams, Telegram, WhatsApp, Signal, iMessage, Intercom, Twilio, ElevenLabs):**
- Endpoints: `/api/integrations/[provider]/route.ts` and `/api/integrations/[provider]/callback/route.ts`
- Example: `src/app/api/integrations/slack/route.ts` and `callback/route.ts`
- OAuth scope: Provider-specific permissions for messaging, channel access, files, calls

**Calendars & Scheduling (Google Calendar, Outlook, Calendly, Cal.com):**
- OAuth provides access to read/write calendar events, availability, scheduling

**CRM (HubSpot, Salesforce, Pipedrive, Close, Apollo, LinkedIn Sales Navigator, Outreach, Gong):**
- OAuth integrations for contact management, deal tracking, sales pipeline automation

**Project Management (Linear, Jira, Asana, Monday.com, Trello, ClickUp, Basecamp):**
- OAuth for task creation, status tracking, team collaboration

**Development (GitHub, GitLab, Bitbucket):**
- OAuth for repository access, CI/CD integration, code management

**Monitoring & Analytics (Datadog, PagerDuty, Sentry, New Relic, Google Analytics, Mixpanel, Amplitude, Segment):**
- Error/performance tracking and analytics

**Documentation (Notion, Confluence, Coda, Airtable, Google Docs):**
- OAuth for document access and management

**Finance (Stripe, QuickBooks, Xero, Expensify, Bill.com):**
- Payment and accounting integrations

**HR (Greenhouse, Lever, BambooHR, Workday):**
- Recruitment and HR management

**Support & Marketing (Zendesk, Freshdesk, Help Scout, Buffer, Hootsuite, Mailchimp, SendGrid, Twitter, Snyk, 1Password):**
- Customer support, marketing automation, social media

## Webhooks & Callbacks

**Incoming:**
- Stripe webhooks: `/api/webhooks/stripe` - checkout.session.completed, customer.subscription.updated/deleted, invoice.paid/payment_failed
- OAuth callbacks: `/api/integrations/[provider]/callback` - All OAuth providers (50+)

**Outgoing:**
- Not detected in codebase - Integrations appear to be receive-only or actively polled

---

*Integration audit: 2026-02-13*
