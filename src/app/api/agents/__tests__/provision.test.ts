import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockUser, createMockAgent, createMockAgentInstance } from '@/test/utils'

const mockUser = createMockUser({
  id: 'user-uuid',
  email: 'user@example.com',
})

const mockAgent = createMockAgent({
  id: 'agent-uuid',
  userId: 'user-uuid',
  name: 'Test Agent',
  status: 'draft',
})

const mockInstance = createMockAgentInstance({
  id: 'instance-uuid',
  agentId: 'agent-uuid',
  status: 'pending',
  region: 'us-east',
})

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      agents: {
        findFirst: vi.fn(),
      },
      integrations: {
        findFirst: vi.fn(),
      },
    },
  },
}))

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/subscription', () => ({
  getUserSubscription: vi.fn().mockResolvedValue({ isActive: true }),
}))

vi.mock('@/lib/provisioning', () => ({
  queueAgentProvisioning: vi.fn(),
  getProvisioningStatus: vi.fn(),
  getProvisioningSteps: vi.fn().mockReturnValue([
    { id: 'queue', label: 'Queued', status: 'complete' },
    { id: 'provision', label: 'Provisioning', status: 'current' },
    { id: 'configure', label: 'Configuring', status: 'pending' },
    { id: 'start', label: 'Starting', status: 'pending' },
  ]),
}))

describe('Agent Provisioning API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/agents/[id]/provision', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const { POST } = await import('@/app/api/agents/[id]/provision/route')
      
      const request = new Request('http://localhost:3000/api/agents/agent-uuid/provision', {
        method: 'POST',
        body: JSON.stringify({ region: 'us-east' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'agent-uuid' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Not authenticated')
    })

    it('should return 404 when agent is not found', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.agents.findFirst).mockResolvedValue(undefined)

      const { POST } = await import('@/app/api/agents/[id]/provision/route')
      
      const request = new Request('http://localhost:3000/api/agents/nonexistent/provision', {
        method: 'POST',
        body: JSON.stringify({ region: 'us-east' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'nonexistent' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Agent not found')
    })

    it('should return 404 when agent belongs to different user', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.agents.findFirst).mockResolvedValue({
        ...mockAgent,
        userId: 'different-user-uuid',
      } as any)

      const { POST } = await import('@/app/api/agents/[id]/provision/route')
      
      const request = new Request('http://localhost:3000/api/agents/agent-uuid/provision', {
        method: 'POST',
        body: JSON.stringify({ region: 'us-east' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'agent-uuid' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Agent not found')
    })

    it('should queue provisioning successfully', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.agents.findFirst).mockResolvedValue(mockAgent as any)

      const { queueAgentProvisioning } = await import('@/lib/provisioning')
      vi.mocked(queueAgentProvisioning).mockResolvedValue(mockInstance as any)

      const { POST } = await import('@/app/api/agents/[id]/provision/route')
      
      const request = new Request('http://localhost:3000/api/agents/agent-uuid/provision', {
        method: 'POST',
        body: JSON.stringify({ region: 'eu-central' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'agent-uuid' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.instance).toBeDefined()
      expect(data.steps).toBeDefined()
      expect(queueAgentProvisioning).toHaveBeenCalledWith('agent-uuid', 'eu-central', 'user-uuid')
    })

    it('should use default region when not specified', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.agents.findFirst).mockResolvedValue(mockAgent as any)

      const { queueAgentProvisioning } = await import('@/lib/provisioning')
      vi.mocked(queueAgentProvisioning).mockResolvedValue(mockInstance as any)

      const { POST } = await import('@/app/api/agents/[id]/provision/route')
      
      // Request without body
      const request = new Request('http://localhost:3000/api/agents/agent-uuid/provision', {
        method: 'POST',
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'agent-uuid' }) })

      expect(response.status).toBe(200)
      expect(queueAgentProvisioning).toHaveBeenCalledWith('agent-uuid', 'us-east', 'user-uuid')
    })

    it('should return 400 when provisioning fails', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.agents.findFirst).mockResolvedValue(mockAgent as any)

      const { queueAgentProvisioning } = await import('@/lib/provisioning')
      vi.mocked(queueAgentProvisioning).mockRejectedValue(new Error('Server provisioning failed'))

      const { POST } = await import('@/app/api/agents/[id]/provision/route')
      
      const request = new Request('http://localhost:3000/api/agents/agent-uuid/provision', {
        method: 'POST',
        body: JSON.stringify({ region: 'us-east' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request, { params: Promise.resolve({ id: 'agent-uuid' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Server provisioning failed')
    })
  })

  describe('GET /api/agents/[id]/provision', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const { GET } = await import('@/app/api/agents/[id]/provision/route')
      
      const request = new Request('http://localhost:3000/api/agents/agent-uuid/provision')
      const response = await GET(request, { params: Promise.resolve({ id: 'agent-uuid' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Not authenticated')
    })

    it('should return null instance when not provisioned', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.agents.findFirst).mockResolvedValue(mockAgent as any)

      const { getProvisioningStatus } = await import('@/lib/provisioning')
      vi.mocked(getProvisioningStatus).mockResolvedValue(null)

      const { GET } = await import('@/app/api/agents/[id]/provision/route')
      
      const request = new Request('http://localhost:3000/api/agents/agent-uuid/provision')
      const response = await GET(request, { params: Promise.resolve({ id: 'agent-uuid' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.instance).toBeNull()
      expect(data.steps).toBeNull()
    })

    it('should return provisioning status', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.agents.findFirst).mockResolvedValue(mockAgent as any)

      const { getProvisioningStatus } = await import('@/lib/provisioning')
      vi.mocked(getProvisioningStatus).mockResolvedValue({
        ...mockInstance,
        status: 'running',
        serverIp: '192.168.1.100',
      } as any)

      const { GET } = await import('@/app/api/agents/[id]/provision/route')
      
      const request = new Request('http://localhost:3000/api/agents/agent-uuid/provision')
      const response = await GET(request, { params: Promise.resolve({ id: 'agent-uuid' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.instance).toBeDefined()
      expect(data.instance.status).toBe('running')
      expect(data.steps).toBeDefined()
    })
  })
})
