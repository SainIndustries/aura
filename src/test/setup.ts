import '@testing-library/jest-dom'
import { vi, beforeAll, afterAll, afterEach } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}))

// Mock Next.js headers/cookies
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === 'privy-token') {
        return { value: 'mock-token' }
      }
      return undefined
    }),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => new Headers()),
}))

// Mock Privy React Auth
vi.mock('@privy-io/react-auth', () => ({
  usePrivy: () => ({
    ready: true,
    authenticated: true,
    user: {
      id: 'test-privy-user-id',
      email: { address: 'test@example.com' },
    },
    login: vi.fn(),
    logout: vi.fn(),
    linkEmail: vi.fn(),
    linkWallet: vi.fn(),
  }),
  PrivyProvider: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock Privy Server Auth
vi.mock('@privy-io/server-auth', () => ({
  PrivyClient: vi.fn().mockImplementation(() => ({
    verifyAuthToken: vi.fn().mockResolvedValue({
      userId: 'test-privy-user-id',
    }),
    getUser: vi.fn().mockResolvedValue({
      id: 'test-privy-user-id',
      email: { address: 'test@example.com' },
    }),
  })),
}))

// Mock environment variables
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test')
vi.stubEnv('PRIVY_APP_ID', 'test-app-id')
vi.stubEnv('PRIVY_APP_SECRET', 'test-app-secret')
vi.stubEnv('INTEGRATION_ENCRYPTION_KEY', 'test-encryption-key-32-chars-long')
vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_mock')

// Clean up after each test
afterEach(() => {
  vi.clearAllMocks()
})

// Global test setup
beforeAll(() => {
  // Suppress console errors during tests unless debugging
  if (!process.env.DEBUG) {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  }
})

afterAll(() => {
  vi.restoreAllMocks()
})

// Global test utilities
declare global {
  var testUser: {
    id: string
    privyUserId: string
    email: string
  }
}

globalThis.testUser = {
  id: 'test-user-uuid',
  privyUserId: 'test-privy-user-id',
  email: 'test@example.com',
}
