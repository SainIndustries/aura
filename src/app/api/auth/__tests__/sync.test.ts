import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('POST /api/auth/sync', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('should sync user successfully with valid token', async () => {
    // Mock cookies to return valid token
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

    // Mock Privy client
    vi.doMock('@/lib/privy', () => ({
      getPrivyClient: vi.fn(() => ({
        verifyAuthToken: vi.fn().mockResolvedValue({ userId: 'test-privy-user-id' }),
        getUser: vi.fn().mockResolvedValue({
          id: 'test-privy-user-id',
          email: { address: 'test@example.com' },
        }),
      })),
    }))

    // Mock user sync
    vi.doMock('@/lib/db/user-sync', () => ({
      upsertUser: vi.fn().mockResolvedValue({
        id: 'test-user-uuid',
        privyUserId: 'test-privy-user-id',
        email: 'test@example.com',
        name: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    }))

    const { POST } = await import('@/app/api/auth/sync/route')
    
    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.user).toBeDefined()
    expect(data.user.email).toBe('test@example.com')
  })

  it('should return 401 when no token is present', async () => {
    // Mock cookies to return no token
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn(() => undefined),
      }),
    }))

    const { POST } = await import('@/app/api/auth/sync/route')
    
    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Not authenticated')
  })

  it('should return 500 when privy verification fails', async () => {
    // Mock cookies with token
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn((name: string) => {
          if (name === 'privy-token') {
            return { value: 'invalid-token' }
          }
          return undefined
        }),
      }),
    }))

    // Mock Privy client to throw error
    vi.doMock('@/lib/privy', () => ({
      getPrivyClient: vi.fn(() => ({
        verifyAuthToken: vi.fn().mockRejectedValue(new Error('Invalid token')),
        getUser: vi.fn(),
      })),
    }))

    const { POST } = await import('@/app/api/auth/sync/route')
    
    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to sync user')
  })

  it('should return 500 when database upsert fails', async () => {
    // Mock cookies with token
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

    // Mock Privy client
    vi.doMock('@/lib/privy', () => ({
      getPrivyClient: vi.fn(() => ({
        verifyAuthToken: vi.fn().mockResolvedValue({ userId: 'test-privy-user-id' }),
        getUser: vi.fn().mockResolvedValue({
          id: 'test-privy-user-id',
          email: { address: 'test@example.com' },
        }),
      })),
    }))

    // Mock user sync to throw error
    vi.doMock('@/lib/db/user-sync', () => ({
      upsertUser: vi.fn().mockRejectedValue(new Error('Database error')),
    }))

    const { POST } = await import('@/app/api/auth/sync/route')
    
    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to sync user')
  })
})
