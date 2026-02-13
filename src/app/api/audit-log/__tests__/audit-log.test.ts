import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockUser, createMockAuditLog, createMockAgent } from '@/test/utils'

const mockUser = createMockUser({
  id: 'user-uuid',
  email: 'user@example.com',
})

const mockAgent = createMockAgent({
  id: 'agent-uuid',
  userId: 'user-uuid',
  name: 'Test Agent',
})

const mockLogs = [
  createMockAuditLog({
    id: 'log-1',
    userId: 'user-uuid',
    agentId: 'agent-uuid',
    category: 'agent',
    action: 'agent_started',
    description: 'Agent was started',
    status: 'success',
  }),
  createMockAuditLog({
    id: 'log-2',
    userId: 'user-uuid',
    agentId: 'agent-uuid',
    category: 'communication',
    action: 'email_sent',
    description: 'Email was sent successfully',
    status: 'success',
  }),
  createMockAuditLog({
    id: 'log-3',
    userId: 'user-uuid',
    category: 'integration',
    action: 'integration_connected',
    description: 'Google integration connected',
    status: 'success',
  }),
]

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUser: vi.fn(),
}))

describe('Audit Log API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/audit-log', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const { GET } = await import('@/app/api/audit-log/route')
      
      const request = new NextRequest('http://localhost:3000/api/audit-log')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return logs with default pagination', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      
      // Mock the chained query
      const mockOffset = vi.fn().mockResolvedValue(mockLogs.map(log => ({
        ...log,
        agentName: mockAgent.name,
      })))
      
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: mockOffset,
                }),
              }),
            }),
          }),
        }),
      } as any)

      // Mock count query (second select call)
      const originalSelect = db.select
      let callCount = 0
      vi.mocked(db.select).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: mockOffset,
                    }),
                  }),
                }),
              }),
            }),
          } as any
        }
        // Count query
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 3 }]),
          }),
        } as any
      })

      const { GET } = await import('@/app/api/audit-log/route')
      
      const request = new NextRequest('http://localhost:3000/api/audit-log')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.logs).toBeDefined()
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(25)
    })

    it('should filter logs by category', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      
      const filteredLogs = mockLogs.filter(log => log.category === 'agent')
      
      let callCount = 0
      vi.mocked(db.select).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue(filteredLogs.map(log => ({
                        ...log,
                        agentName: mockAgent.name,
                      }))),
                    }),
                  }),
                }),
              }),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        } as any
      })

      const { GET } = await import('@/app/api/audit-log/route')
      
      const request = new NextRequest('http://localhost:3000/api/audit-log?category=agent')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.logs).toHaveLength(1)
      expect(data.logs[0].category).toBe('agent')
    })

    it('should support pagination parameters', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      
      let callCount = 0
      vi.mocked(db.select).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 50 }]),
          }),
        } as any
      })

      const { GET } = await import('@/app/api/audit-log/route')
      
      const request = new NextRequest('http://localhost:3000/api/audit-log?page=2&limit=10')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pagination.page).toBe(2)
      expect(data.pagination.limit).toBe(10)
      expect(data.pagination.totalPages).toBe(5)
    })

    it('should filter by date range', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      
      let callCount = 0
      vi.mocked(db.select).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 0 }]),
          }),
        } as any
      })

      const { GET } = await import('@/app/api/audit-log/route')
      
      const request = new NextRequest('http://localhost:3000/api/audit-log?startDate=2024-01-01&endDate=2024-01-31')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.logs).toBeDefined()
    })

    it('should support search filter', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      
      let callCount = 0
      vi.mocked(db.select).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue([mockLogs[1]]),
                    }),
                  }),
                }),
              }),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 1 }]),
          }),
        } as any
      })

      const { GET } = await import('@/app/api/audit-log/route')
      
      const request = new NextRequest('http://localhost:3000/api/audit-log?search=email')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
    })

    it('should limit max results to 100', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      
      let callCount = 0
      vi.mocked(db.select).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return {
            from: vi.fn().mockReturnValue({
              leftJoin: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      offset: vi.fn().mockResolvedValue([]),
                    }),
                  }),
                }),
              }),
            }),
          } as any
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ count: 200 }]),
          }),
        } as any
      })

      const { GET } = await import('@/app/api/audit-log/route')
      
      const request = new NextRequest('http://localhost:3000/api/audit-log?limit=500')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      // Should be capped at 100
      expect(data.pagination.limit).toBe(100)
    })
  })
})
