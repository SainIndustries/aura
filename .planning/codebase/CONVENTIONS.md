# Coding Conventions

**Analysis Date:** 2026-02-13

## Naming Patterns

**Files:**
- PascalCase for React components: `HeroSection.tsx`, `Card.tsx`, `NavBar.tsx`
- camelCase for non-component files: `current-user.ts`, `utils.ts`, `use-mobile.ts`
- kebab-case for directory names: `src/components/ui`, `src/lib/auth`, `src/app/api/integrations`
- Route files always named `route.ts`: `src/app/api/chat/route.ts`, `src/app/api/auth/sync/route.ts`
- Test files use `.test.ts` suffix and co-located in `__tests__` subdirectories: `src/app/api/auth/__tests__/sync.test.ts`

**Functions:**
- camelCase for all functions: `getCurrentUser()`, `checkRateLimit()`, `useUserSync()`, `createMockUser()`
- Handler functions (API route handlers): PascalCase `POST()`, `GET()`, `PUT()`, `DELETE()`
- Hook functions prefixed with `use`: `usePrivy()`, `useIsMobile()`, `useUserSync()`, `useRouter()`

**Variables:**
- camelCase for all variables: `isMobile`, `hasSynced`, `mockAgent`, `createdAt`
- Constants in UPPER_SNAKE_CASE when truly constant: `SYSTEM_PROMPT`, `MOBILE_BREAKPOINT`, `FROM_EMAIL`
- Prefix mock/test variables with `mock`: `mockUser`, `mockAgent`, `mockInstance`

**Types:**
- PascalCase for type/interface names: `MockUser`, `MockAgent`, `CreateAgentData`, `SendEmailParams`
- Export types with explicit `type` keyword: `export type CreateAgentData = z.infer<typeof createAgentSchema>`
- Suffix schema variables with `Schema`: `createAgentSchema`, `sendEmailSchema`

## Code Style

**Formatting:**
- ESLint 9 with Next.js config (`eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`)
- Uses flat config system (`eslint.config.mjs`)
- TypeScript strict mode enabled

**Linting:**
- ESLint enforces Next.js core web vitals and TypeScript best practices
- Next.js-specific rules for app router, image optimization, and performance
- Global ignores configured for Next.js artifacts: `.next/**`, `out/**`, `build/**`

**Indentation:** 2 spaces (Next.js convention)

**Semicolons:** Required (enforced by Next.js ESLint config)

**Imports:** Always use absolute paths with `@` alias pointing to `./src`:
```typescript
import { getCurrentUser } from "@/lib/auth/current-user"
import { Card } from "@/components/ui/card"
import { usePrivy } from "@privy-io/react-auth"
```

## Import Organization

**Order:**
1. External libraries (React, Next.js, third-party packages)
2. Aliased imports from `@/` paths
3. Relative imports (rare, generally avoided)

**Path Aliases:**
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)
- Use `@` for all internal imports - never use relative paths like `../../../`

**Example organization:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail, emailTemplates } from "@/lib/email";
import { db } from "@/lib/db";
```

## Error Handling

**Patterns:**
- Try-catch blocks in async functions, especially around external API calls
- Return null on non-critical failures in helper functions:
  ```typescript
  export async function getCurrentUser() {
    try {
      // ...logic
      return user ?? null;
    } catch {
      return null;
    }
  }
  ```
- Return objects with `{ success, error }` pattern in utility functions:
  ```typescript
  export async function sendEmail(...): Promise<{ success: boolean; error?: string }> {
    try {
      // ...
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  ```
- Throw errors in lib/provisioning functions for critical failures:
  ```typescript
  throw new Error("Agent not found");
  throw new Error("Agent already has an active or pending instance");
  ```
- API route handlers return NextResponse with HTTP status codes:
  ```typescript
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  return NextResponse.json({ user }, { status: 200 });
  return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  ```
- Always log errors with `console.error()`:
  ```typescript
  console.error("Auth sync error:", error);
  console.error("Chat error:", error);
  ```

## Logging

**Framework:** Native `console` object (no logging framework)

**Patterns:**
- Use `console.error()` for errors: `console.error("Chat error:", error)`
- Use `console.warn()` for warnings: `console.warn("Email not configured: RESEND_API_KEY missing")`
- Prefix log messages with context: `"Auth sync error:"`, `"Failed to send email:"`
- Log errors from external integrations with operation context
- Conditionally suppress console errors in tests via DEBUG environment variable

## Comments

**When to Comment:**
- Complex business logic or non-obvious algorithms
- Integration-specific behavior (e.g., Privy token verification)
- System prompts for AI (documented as string constants)
- Why something is done (not what - the code shows what)

**JSDoc/TSDoc:**
- Not consistently used, but type inference via TypeScript and Zod schemas provides type documentation
- Function parameters documented via TypeScript types: `SendEmailParams` interface documents expected shape
- Zod schemas serve as runtime validation and documentation: `createAgentSchema` describes agent creation requirements

## Function Design

**Size:** Generally keep functions under 50 lines; API route handlers acceptable up to 70-80 lines

**Parameters:**
- Use object destructuring for multiple parameters:
  ```typescript
  export async function sendEmail({ to, subject, html, text, replyTo }: SendEmailParams)
  ```
- Use generic type variables sparingly
- Pass Request/NextRequest as first parameter in API handlers

**Return Values:**
- Async functions return Promise types or JSON-serializable objects
- Preference for `null` over `undefined` in nullable returns
- API handlers return NextResponse or NextResponse.json()
- Email sending returns `{ success: boolean; error?: string }`

## Module Design

**Exports:**
- Named exports for functions and types: `export async function sendEmail(...)`
- Default exports for page components: `export default function HomePage()`
- Barrel exports (index.ts) used minimally, prefer direct imports

**Barrel Files:**
- `src/lib/integrations/index.ts` re-exports integration utilities
- `src/lib/provisioning/index.ts` re-exports provisioning functions
- Not used extensively; most imports are direct to source file

**File Structure:**
- One main export per file (preferred)
- Utility constants defined at module level (SYSTEM_PROMPT, MOBILE_BREAKPOINT, FROM_EMAIL)
- Email templates exported as object property: `emailTemplates.welcome()`, `emailTemplates.teamInvite()`

## Type Safety

**TypeScript:**
- Strict mode enabled
- Use Zod for runtime validation of API inputs:
  ```typescript
  export const createAgentSchema = z.object({
    name: z.string().min(1, "Name is required").max(100),
    personality: z.string().max(1000).optional(),
  });
  ```
- Infer types from Zod schemas: `type CreateAgentData = z.infer<typeof createAgentSchema>`
- Use `React.ComponentProps<"div">` for component prop typing (functional components)
- Function parameters typed explicitly, return types inferred when possible

**Component Props:**
- Spread HTML element props for built-in elements:
  ```typescript
  function Card({ className, ...props }: React.ComponentProps<"div">) {
    return <div className={cn("...", className)} {...props} />
  }
  ```

## Styling

**Framework:** Tailwind CSS v4 with PostCSS

**Utility Usage:**
- Use shadcn component library for UI components: `Card`, `Dialog`, `Sheet`, `Tabs`
- Merge Tailwind classes with `cn()` utility:
  ```typescript
  className={cn(
    "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
    className
  )}
  ```
- Class merging utility at `src/lib/utils.ts`:
  ```typescript
  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
  }
  ```

---

*Convention analysis: 2026-02-13*
