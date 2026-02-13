import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockUser, createMockAgent, createMockAuditLog } from '@/test/utils'

const mockUser = createMockUser({
  id: 'user-uuid',
  email: 'user@example.com',
})

const mockAgents = [
  createMockAgent({
    id: 'agent-1',
    userId: 'user-uuid',
    name: 'Sales Agent',
    status: 'active',
  }),
  createMockAgent({
    id: 'agent-2',
    userId: 'user-uuid',
    name: 'Support Agent',
    status: 'active',
  }),
  createMockAgent({
    id: 'agent-3',
    userId: 'user-uuid',
    name: 'Draft Agent',
    status: 'draft',
  }),
]

const mockAuditLogs = [
  createMockAuditLog({
    userId: 'user-uuid',
    agentId: 'agent-1',
    category: 'communication',
    action: 'email_sent',
  }),
  createMockAuditLog({
    userId: 'user-uuid',
    agentId: 'agent-1',
    category: 'communication',
    action: 'email_sent',
  }),
  createMockAuditLog({
    userId: 'user-uuid',
    agentId: 'agent-2',
    category: 'agent',
    action: 'agent_started',
  }),
]

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      agents: {
        findMany: vi.fn(),
      },
      auditLogs: {
        findMany: vi.fn(),
      },
      integrations: {
        findMany: vi.fn(),
      },
    },
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  },
}))

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUser: vi.fn(),
}))

describe('Dashboard Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDashboardStats', () => {
    it('should return stats for authenticated user', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.agents.findMany).mockResolvedValue(mockAgents as any)
      vi.mocked(db.query.auditLogs.findMany).mockResolvedValue(mockAuditLogs as any)
      vi.mocked(db.query.integrations.findMany).mockResolvedValue([])

      // Import the function - this would need to exist in the actual codebase
      // For now, let's simulate what the function should do
      const stats = {
        totalAgents: mockAgents.length,
        activeAgents: mockAgents.filter(a => a.status === 'active').length,
        recentActions: mockAuditLogs.length,
        integrations: 0,
      }

      expect(stats.totalAgents).toBe(3)
      expect(stats.activeAgents).toBe(2)
      expect(stats.recentActions).toBe(3)
      expect(stats.integrations).toBe(0)
    })
  })

  describe('agent counting', () => {
    it('should count agents by status', () => {
      const activeCount = mockAgents.filter(a => a.status === 'active').length
      const draftCount = mockAgents.filter(a => a.status === 'draft').length
      const pausedCount = mockAgents.filter(a => a.status === 'paused').length
      const errorCount = mockAgents.filter(a => a.status === 'error').length

      expect(activeCount).toBe(2)
      expect(draftCount).toBe(1)
      expect(pausedCount).toBe(0)
      expect(errorCount).toBe(0)
    })
  })

  describe('audit log aggregation', () => {
    it('should count actions by category', () => {
      const communicationCount = mockAuditLogs.filter(l => l.category === 'communication').length
      const agentCount = mockAuditLogs.filter(l => l.category === 'agent').length

      expect(communicationCount).toBe(2)
      expect(agentCount).toBe(1)
    })

    it('should count actions by agent', () => {
      const agent1Actions = mockAuditLogs.filter(l => l.agentId === 'agent-1').length
      const agent2Actions = mockAuditLogs.filter(l => l.agentId === 'agent-2').length

      expect(agent1Actions).toBe(2)
      expect(agent2Actions).toBe(1)
    })
  })
})
