import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockUser, createMockIntegration } from '@/test/utils'

const mockUser = createMockUser({
  id: 'user-uuid',
  email: 'user@example.com',
})

const mockIntegrations = [
  createMockIntegration({
    id: 'integration-1',
    userId: 'user-uuid',
    provider: 'google',
    scopes: ['calendar', 'gmail'],
  }),
  createMockIntegration({
    id: 'integration-2',
    userId: 'user-uuid',
    provider: 'slack',
    scopes: ['chat:write', 'channels:read'],
  }),
]

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      integrations: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  },
}))

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUser: vi.fn(),
}))

describe('Integrations API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/integrations', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const { GET } = await import('@/app/api/integrations/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return user integrations', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.integrations.findMany).mockResolvedValue(mockIntegrations as any)

      const { GET } = await import('@/app/api/integrations/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(2)
      expect(data[0].provider).toBe('google')
      expect(data[1].provider).toBe('slack')
    })

    it('should return empty array when no integrations', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.integrations.findMany).mockResolvedValue([])

      const { GET } = await import('@/app/api/integrations/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(0)
    })
  })

  describe('POST /api/integrations', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const { POST } = await import('@/app/api/integrations/route')
      
      const request = new Request('http://localhost:3000/api/integrations', {
        method: 'POST',
        body: JSON.stringify({ provider: 'github' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 when provider is missing', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { POST } = await import('@/app/api/integrations/route')
      
      const request = new Request('http://localhost:3000/api/integrations', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Provider is required')
    })

    it('should create new integration', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.integrations.findFirst).mockResolvedValue(null)

      const newIntegration = createMockIntegration({
        provider: 'github',
        scopes: ['repo', 'user'],
      })

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newIntegration]),
        }),
      } as any)

      const { POST } = await import('@/app/api/integrations/route')
      
      const request = new Request('http://localhost:3000/api/integrations', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'github',
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          scopes: ['repo', 'user'],
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.provider).toBe('github')
    })

    it('should update existing integration', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.integrations.findFirst).mockResolvedValue(mockIntegrations[0] as any)

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      } as any)

      const { POST } = await import('@/app/api/integrations/route')
      
      const request = new Request('http://localhost:3000/api/integrations', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'google',
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.updated).toBe(true)
    })
  })

  describe('DELETE /api/integrations', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const { DELETE } = await import('@/app/api/integrations/route')
      
      const request = new Request('http://localhost:3000/api/integrations?provider=google', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 when provider is missing', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { DELETE } = await import('@/app/api/integrations/route')
      
      const request = new Request('http://localhost:3000/api/integrations', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Provider is required')
    })

    it('should return 404 when integration not found', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.integrations.findFirst).mockResolvedValue(null)

      const { DELETE } = await import('@/app/api/integrations/route')
      
      const request = new Request('http://localhost:3000/api/integrations?provider=nonexistent', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Integration not found')
    })

    it('should delete integration successfully', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.integrations.findFirst).mockResolvedValue(mockIntegrations[0] as any)

      vi.mocked(db.delete).mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      } as any)

      const { DELETE } = await import('@/app/api/integrations/route')
      
      const request = new Request('http://localhost:3000/api/integrations?provider=google', {
        method: 'DELETE',
      })

      const response = await DELETE(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })
})
