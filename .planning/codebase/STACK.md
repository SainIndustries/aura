# Technology Stack

**Analysis Date:** 2026-02-13

## Languages

**Primary:**
- TypeScript 5.x - All source code, configuration, and type-safe development

**Secondary:**
- JavaScript/JSX - React components and Next.js framework (transpiled from TypeScript)
- CSS - Styling via Tailwind CSS and PostCSS

## Runtime

**Environment:**
- Node.js (version specified in `.nvmrc` or inferred from Next.js 16.1.6 requirements)

**Package Manager:**
- npm or yarn (inferred from package.json; no lockfile specified, likely npm)
- Lockfile: package.json present, likely using npm

## Frameworks

**Core:**
- Next.js 16.1.6 - Full-stack React framework with App Router, server components, API routes
- React 19.2.3 - UI component library
- React DOM 19.2.3 - React web rendering

**UI Components & Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework
- Radix UI 1.4.3 - Unstyled, composable accessible UI primitives
- shadcn (3.8.4) - Pre-built Tailwind + Radix UI component library
- Lucide React 0.563.0 - Icon library
- Sonner 2.0.7 - Toast notification library
- class-variance-authority 0.7.1 - CSS class variant utility
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.4.0 - Merge Tailwind CSS classes intelligently

**Form Handling:**
- React Hook Form 7.71.1 - Performant form library
- @hookform/resolvers 5.2.2 - Schema validation resolvers for React Hook Form
- Zod 4.3.6 - TypeScript-first schema validation library

**Database:**
- Drizzle ORM 0.45.1 - Type-safe SQL ORM for TypeScript
- drizzle-kit 0.31.9 - CLI and migration tools for Drizzle ORM
- @neondatabase/serverless 1.0.2 - Neon serverless Postgres driver

**Testing:**
- Vitest 4.0.18 - Unit test framework (Vite-native replacement for Jest)
- @vitest/coverage-v8 4.0.18 - Code coverage via V8
- @testing-library/react 16.3.2 - React component testing utilities
- @testing-library/jest-dom 6.9.1 - Custom Jest matchers for DOM testing
- Playwright 1.58.2 - End-to-end testing framework
- @playwright/test 1.58.2 - Playwright test runner
- jsdom 28.0.0 - DOM implementation for Node.js testing

**Build & Development:**
- TypeScript 5.x - Typed language transpiler
- ESLint 9.x - JavaScript/TypeScript linter
- eslint-config-next 16.1.6 - Next.js ESLint configuration
- PostCSS 4.x - CSS transformation tool (via @tailwindcss/postcss)
- @vitejs/plugin-react 5.1.4 - Vite React plugin for testing

**Error Tracking & Observability:**
- @sentry/nextjs 10.38.0 - Error tracking and performance monitoring for Next.js

**Rate Limiting & Caching:**
- @upstash/redis 1.36.2 - Upstash Redis client library
- @upstash/ratelimit 2.0.8 - Rate limiting built on Upstash Redis

**Authentication & Identity:**
- @privy-io/react-auth 3.13.1 - Client-side Privy authentication provider
- @privy-io/server-auth 1.32.5 - Server-side Privy authentication verification

**Payments:**
- stripe 20.3.1 - Stripe payment platform SDK

**Email:**
- resend 6.9.2 - Email delivery service SDK

**Utilities:**
- dotenv 17.3.1 - Environment variable loading
- @next/third-parties 16.1.6 - Optimized integrations (Google Analytics, etc.)

## Configuration

**Environment:**
Environment variables stored in `.env.local` (not committed). Required variables:
- `DATABASE_URL` - PostgreSQL connection string (Neon serverless)
- `OPENAI_API_KEY` - OpenAI API key for chat/AI features
- `PRIVY_APP_SECRET` - Privy authentication secret
- `NEXT_PUBLIC_PRIVY_APP_ID` - Privy app ID (public)
- `STRIPE_SECRET_KEY` - Stripe secret key
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signature secret
- `RESEND_API_KEY` - Resend email API key
- `UPSTASH_REDIS_REST_URL` - Upstash Redis endpoint
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry error tracking DSN (public)
- `NEXT_PUBLIC_APP_URL` - Application base URL
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` - Google Analytics measurement ID
- `FROM_EMAIL` - Sender email address (defaults to `Aura <noreply@moreaura.ai>`)
- Integration OAuth credentials (per provider):
  - `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
  - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
  - And similar for 50+ supported integrations

**Build:**
- `next.config.ts` - Next.js configuration with Sentry integration
- `tsconfig.json` - TypeScript compiler options with path alias `@/*` → `./src/*`
- `tailwind.config.ts` (inferred) - Tailwind CSS configuration
- `postcss.config.mjs` - PostCSS configuration
- `drizzle.config.ts` - Drizzle ORM configuration (PostgreSQL, schema at `./src/lib/db/schema.ts`)
- `vitest.config.ts` - Vitest unit test configuration
- `playwright.config.ts` - Playwright E2E test configuration
- `eslint.config.mjs` - ESLint rules and plugins

## Platform Requirements

**Development:**
- Node.js (version TBD, likely 18.17+ for Next.js 16)
- npm or yarn package manager
- PostgreSQL database (Neon serverless in production)

**Production:**
- Vercel (inferred from Next.js adoption and Sentry Vercel integration)
- PostgreSQL database via Neon serverless
- Upstash Redis for caching/rate limiting
- External services: OpenAI, Stripe, Resend, Sentry, Privy, 50+ OAuth integrations

---

*Stack analysis: 2026-02-13*
