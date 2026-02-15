# Testing Patterns

**Analysis Date:** 2026-02-13

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`

**Assertion Library:**
- Vitest built-in expect API

**Run Commands:**
```bash
npm run test:run              # Run all tests once
npm run test                  # Run tests in watch mode
npm run test:ui               # Open interactive test UI
npm run test:coverage         # Generate coverage report (v8)
npm run test:watch            # Run tests and watch for changes
npm run test:e2e              # Run Playwright end-to-end tests
npm run test:e2e:ui           # Run Playwright tests with UI
```

**Environment:**
- jsdom for browser environment simulation
- React 19.2.3 with @vitejs/plugin-react
- Setup file: `src/test/setup.ts`

## Test File Organization

**Location:** Co-located with source code in `__tests__` subdirectories

**Naming:** `.test.ts` suffix (not `.spec.ts`)

**Structure:**
```
src/app/api/auth/__tests__/sync.test.ts
src/app/api/agents/__tests__/provision.test.ts
src/app/api/integrations/cal-com/__tests__/route.test.ts
src/lib/__tests__/encryption.test.ts
src/components/__tests__/[component-tests]
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('POST /api/auth/sync', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should sync user successfully with valid token', async () => {
    // Arrange: Set up mocks
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === 'privy-token') {
            return { value: 'valid-mock-token' }
          }
          return undefined
        }),
      }),
    }))

    // Act: Execute test
    const { POST } = await import('@/app/api/auth/sync/route')
    const response = await POST()
    const data = await response.json()

    // Assert: Verify expectations
    expect(response.status).toBe(200)
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('test@example.com')
  })

  it('should return 401 when no token is present', async () => {
    // Test structure follows Arrange-Act-Assert pattern
  })
})
```

**Patterns:**
- Use `describe()` blocks to group related tests
- Use `beforeEach()` to reset mocks between tests: `vi.resetModules()`, `vi.clearAllMocks()`
- Name tests as behavior assertions: "should X when Y condition"
- Each test is self-contained with its own mocks
- Async tests use `async`/`await`

## Mocking

**Framework:** Vitest's `vi` object for module mocking

**Patterns:**

**1. Module Mocking with vi.doMock():**
```typescript
vi.doMock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn((name: string) => {
      if (name === 'privy-token') {
        return { value: 'valid-mock-token' }
      }
      return undefined
    }),
  }),
}))
```

**2. Global Setup Mocks (src/test/setup.ts):**
```typescript
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    // ...
  }),
  // ...
}))

vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    ready: true,
    authenticated: true,
    user: { id: 'test-privy-user-id', email: { address: 'test@example.com' } },
    login: vi.fn(),
    logout: vi.fn(),
  }),
  PrivyProvider: ({ children }: { children: React.ReactNode }) => children,
}))
```

**3. Function Mocking and Assertions:**
```typescript
const { getCurrentUser } = await import('@/lib/auth/current-user')
vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

// Later: verify the mock was called
expect(queueAgentProvisioning).toHaveBeenCalledWith('agent-uuid', 'eu-central')
```

**4. Environment Variable Mocking:**
```typescript
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')
vi.stubEnv('PRIVY_APP_ID', 'test-app-id')
vi.stubEnv('OPENAI_API_KEY', 'sk_test_mock')
```

**What to Mock:**
- External service clients (Privy, OpenAI, Stripe)
- Next.js framework APIs (headers, cookies, navigation, router)
- Database operations (db.query.*)
- File system operations

**What NOT to Mock:**
- Utility functions that transform data (`cn()`, `clsx()`, `twMerge()`)
- Type definitions and Zod schemas
- Pure JavaScript functions without side effects

## Fixtures and Factories

**Test Data:**
Located in `src/test/utils.tsx` - factory functions that create mock objects with sensible defaults:

```typescript
export const createMockUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: 'user-uuid-' + Math.random().toString(36).substr(2, 9),
  privyUserId: 'privy-user-' + Math.random().toString(36).substr(2, 9),
  email: `user-${Math.random().toString(36).substr(2, 5)}@example.com`,
  name: 'Test User',
  avatarUrl: null,
  stripeCustomerId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockAgent = (overrides: Partial<MockAgent> = {}): MockAgent => ({
  id: 'agent-uuid-' + Math.random().toString(36).substr(2, 9),
  userId: 'user-uuid-' + Math.random().toString(36).substr(2, 9),
  name: 'Test Agent',
  description: 'A test agent for unit testing',
  status: 'draft',
  // ... defaults
  ...overrides,
})
```

**Available Factories:**
- `createMockUser()` - User entity
- `createMockAgent()` - Agent entity
- `createMockIntegration()` - Integration entity
- `createMockTeamMember()` - Team member entity
- `createMockTeamInvite()` - Invitation entity
- `createMockAuditLog()` - Audit log entry
- `createMockChannel()` - Communication channel
- `createMockAgentInstance()` - Agent provisioning instance
- `createMockRequest()` - HTTP Request object for API testing
- `createMockDb()` - In-memory database mock

**Usage in Tests:**
```typescript
const mockUser = createMockUser({
  id: 'user-uuid',
  email: 'user@example.com',
})

const mockAgent = createMockAgent({
  id: 'agent-uuid',
  userId: mockUser.id,
  name: 'Test Agent',
  status: 'draft',
})
```

## Coverage

**Requirements:**
- Statements: 55%
- Branches: 55%
- Functions: 30% (lower for API routes which don't export many functions)
- Lines: 55%

**Exclusions:** `node_modules/`, `src/test/`, `**/*.d.ts`, `**/*.config.*`, `**/types.ts`

**View Coverage:**
```bash
npm run test:coverage
# Generates HTML report at coverage/index.html
```

**Reporter:** v8 with text, json, and HTML output

## Test Types

**Unit Tests:**
- Scope: Individual functions and API handlers
- Approach: Mock all external dependencies
- Location: `src/lib/__tests__/`, `src/app/api/*/route.test.ts`
- Example: `src/app/api/auth/__tests__/sync.test.ts` tests POST/GET handlers with mocked Privy client and database

**Integration Tests:**
- Scope: API routes calling multiple services (auth, database, email)
- Approach: Mock external APIs (Privy, email), use real database connection in CI
- Location: Same as unit tests, marked by testing multiple systems
- Not extensively used - most testing is unit-focused

**E2E Tests:**
- Framework: Playwright 1.58.2
- Location: `e2e/` directory
- Run: `npm run test:e2e`, `npm run test:e2e:ui`
- Scope: User workflows across multiple pages
- Examples: user signup flow, agent creation, integration connection

## Common Patterns

**Async Testing:**
```typescript
it('should sync user successfully with valid token', async () => {
  // ... setup mocks

  const { POST } = await import('@/app/api/auth/sync/route')
  const response = await POST()
  const data = await response.json()

  expect(response.status).toBe(200)
})
```

**Testing API Routes with Dynamic Parameters:**
```typescript
const response = await POST(request, {
  params: Promise.resolve({ id: 'agent-uuid' })
})
```

**Mocking Resolved Values:**
```typescript
const { db } = await import('@/lib/db')
vi.mocked(db.query.agents.findFirst).mockResolvedValue(mockAgent as any)
```

**Mocking Rejected Promises (Error Cases):**
```typescript
const { queueAgentProvisioning } = await import('@/lib/provisioning')
vi.mocked(queueAgentProvisioning).mockRejectedValue(new Error('Server provisioning failed'))
```

**Error Testing:**
```typescript
it('should return 500 when privy verification fails', async () => {
  vi.doMock('@/lib/privy', () => ({
    getPrivyClient: vi.fn(() => ({
      verifyAuthToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
    })),
  }))

  const { POST } = await import('@/app/api/auth/sync/route')
  const response = await POST()
  const data = await response.json()

  expect(response.status).toBe(500)
  expect(data.error).toBe('Failed to sync user')
})
```

**Global Test Setup (src/test/setup.ts):**
```typescript
import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, afterEach } from 'vitest'

// Global mocks for Next.js
vi.mock('next/navigation', () => ({ /* ... */ }))
vi.mock('next/headers', () => ({ /* ... */ }))
vi.mock('@privy-io/react-auth', () => ({ /* ... */ }))
vi.mock('@privy-io/server-auth', () => ({ /* ... */ }))

// Environment stub
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')

// Cleanup
afterEach(() => {
  vi.clearAllMocks()
})

beforeAll(() => {
  // Suppress console errors unless DEBUG
  if (!process.env.DEBUG) {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  }
})

afterAll(() => {
  vi.restoreAllMocks()
})

// Global test utilities
globalThis.testUser = {
  id: 'test-user-uuid',
  privyUserId: 'test-privy-user-id',
  email: 'test@example.com',
}
```

## Vitest Configuration

**Config Location:** `vitest.config.ts`

**Key Settings:**
```typescript
{
  environment: 'jsdom',           // Browser-like environment for testing React
  globals: true,                  // Global test APIs (describe, it, expect)
  setupFiles: ['./src/test/setup.ts'],  // Run before all tests
  include: ['src/**/*.test.{ts,tsx}'],  // Test file pattern
  exclude: ['node_modules/', 'e2e/**'], // Excluded paths
  testTimeout: 10000,             // Timeout for tests
  hookTimeout: 10000,             // Timeout for beforeEach, afterEach
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),  // Path alias
    },
  },
}
```

---

*Testing analysis: 2026-02-13*
