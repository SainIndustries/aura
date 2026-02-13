import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'

// Mock Providers wrapper
const AllProviders = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>
}

// Custom render function that includes providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllProviders, ...options })

// Re-export everything from testing-library
export * from '@testing-library/react'
export { customRender as render }

// ============================================================================
// Mock Data Factories
// ============================================================================

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
  personality: 'Helpful and professional',
  goal: 'Assist with testing',
  heartbeatCron: '*/5 * * * *',
  heartbeatEnabled: false,
  integrations: {},
  config: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockIntegration = (overrides: Partial<MockIntegration> = {}): MockIntegration => ({
  id: 'integration-uuid-' + Math.random().toString(36).substr(2, 9),
  userId: 'user-uuid-' + Math.random().toString(36).substr(2, 9),
  provider: 'google',
  accessToken: 'encrypted-access-token',
  refreshToken: 'encrypted-refresh-token',
  tokenExpiry: new Date(Date.now() + 3600000),
  scopes: ['email', 'calendar'],
  metadata: {},
  connectedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockTeamMember = (overrides: Partial<MockTeamMember> = {}): MockTeamMember => ({
  id: 'team-member-uuid-' + Math.random().toString(36).substr(2, 9),
  userId: 'user-uuid-' + Math.random().toString(36).substr(2, 9),
  workspaceOwnerId: 'owner-uuid-' + Math.random().toString(36).substr(2, 9),
  role: 'member',
  joinedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockTeamInvite = (overrides: Partial<MockTeamInvite> = {}): MockTeamInvite => ({
  id: 'invite-uuid-' + Math.random().toString(36).substr(2, 9),
  workspaceOwnerId: 'owner-uuid-' + Math.random().toString(36).substr(2, 9),
  email: `invite-${Math.random().toString(36).substr(2, 5)}@example.com`,
  role: 'member',
  status: 'pending',
  token: 'invite-token-' + Math.random().toString(36).substr(2, 9),
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  acceptedAt: null,
  createdAt: new Date(),
  ...overrides,
})

export const createMockAuditLog = (overrides: Partial<MockAuditLog> = {}): MockAuditLog => ({
  id: 'audit-log-uuid-' + Math.random().toString(36).substr(2, 9),
  userId: 'user-uuid-' + Math.random().toString(36).substr(2, 9),
  agentId: null,
  category: 'agent',
  action: 'agent_created',
  description: 'Agent was created',
  metadata: {},
  status: 'success',
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0 (Test)',
  createdAt: new Date(),
  ...overrides,
})

export const createMockChannel = (overrides: Partial<MockChannel> = {}): MockChannel => ({
  id: 'channel-uuid-' + Math.random().toString(36).substr(2, 9),
  userId: 'user-uuid-' + Math.random().toString(36).substr(2, 9),
  agentId: null,
  type: 'web',
  name: 'Test Channel',
  enabled: true,
  config: {},
  connectedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

export const createMockAgentInstance = (overrides: Partial<MockAgentInstance> = {}): MockAgentInstance => ({
  id: 'instance-uuid-' + Math.random().toString(36).substr(2, 9),
  agentId: 'agent-uuid-' + Math.random().toString(36).substr(2, 9),
  status: 'pending',
  serverId: null,
  serverIp: null,
  tailscaleIp: null,
  region: 'us-east',
  error: null,
  startedAt: null,
  stoppedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

// ============================================================================
// Type Definitions
// ============================================================================

export interface MockUser {
  id: string
  privyUserId: string
  email: string
  name: string | null
  avatarUrl: string | null
  stripeCustomerId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface MockAgent {
  id: string
  userId: string
  name: string
  description: string | null
  status: 'draft' | 'active' | 'paused' | 'error'
  personality: string | null
  goal: string | null
  heartbeatCron: string | null
  heartbeatEnabled: boolean
  integrations: Record<string, unknown>
  config: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface MockIntegration {
  id: string
  userId: string
  provider: string
  accessToken: string | null
  refreshToken: string | null
  tokenExpiry: Date | null
  scopes: string[] | null
  metadata: Record<string, unknown> | null
  connectedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface MockTeamMember {
  id: string
  userId: string
  workspaceOwnerId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  joinedAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface MockTeamInvite {
  id: string
  workspaceOwnerId: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'pending' | 'accepted' | 'expired' | 'revoked'
  token: string
  expiresAt: Date
  acceptedAt: Date | null
  createdAt: Date
}

export interface MockAuditLog {
  id: string
  userId: string
  agentId: string | null
  category: 'agent' | 'communication' | 'calendar' | 'pipeline' | 'integration' | 'system' | 'billing'
  action: string
  description: string
  metadata: Record<string, unknown> | null
  status: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

export interface MockChannel {
  id: string
  userId: string
  agentId: string | null
  type: 'web' | 'slack' | 'telegram' | 'whatsapp' | 'discord' | 'email' | 'phone'
  name: string
  enabled: boolean
  config: Record<string, unknown> | null
  connectedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface MockAgentInstance {
  id: string
  agentId: string
  status: 'pending' | 'provisioning' | 'running' | 'stopping' | 'stopped' | 'failed'
  serverId: string | null
  serverIp: string | null
  tailscaleIp: string | null
  region: string
  error: string | null
  startedAt: Date | null
  stoppedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// Database Mock Helpers
// ============================================================================

export const createMockDb = () => {
  const users: MockUser[] = []
  const agents: MockAgent[] = []
  const integrations: MockIntegration[] = []
  const teamMembers: MockTeamMember[] = []
  const teamInvites: MockTeamInvite[] = []
  const auditLogs: MockAuditLog[] = []
  const channels: MockChannel[] = []
  const agentInstances: MockAgentInstance[] = []

  return {
    users,
    agents,
    integrations,
    teamMembers,
    teamInvites,
    auditLogs,
    channels,
    agentInstances,

    // User operations
    insertUser: (user: MockUser) => {
      users.push(user)
      return user
    },
    findUserById: (id: string) => users.find(u => u.id === id),
    findUserByPrivyId: (privyUserId: string) => users.find(u => u.privyUserId === privyUserId),

    // Agent operations
    insertAgent: (agent: MockAgent) => {
      agents.push(agent)
      return agent
    },
    findAgentById: (id: string) => agents.find(a => a.id === id),
    findAgentsByUserId: (userId: string) => agents.filter(a => a.userId === userId),

    // Integration operations
    insertIntegration: (integration: MockIntegration) => {
      integrations.push(integration)
      return integration
    },
    findIntegrationsByUserId: (userId: string) => integrations.filter(i => i.userId === userId),

    // Reset all data
    reset: () => {
      users.length = 0
      agents.length = 0
      integrations.length = 0
      teamMembers.length = 0
      teamInvites.length = 0
      auditLogs.length = 0
      channels.length = 0
      agentInstances.length = 0
    },
  }
}

// ============================================================================
// API Test Helpers
// ============================================================================

export const createMockRequest = (options: {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  searchParams?: Record<string, string>
} = {}): Request => {
  const { method = 'GET', body, headers = {}, searchParams = {} } = options

  const url = new URL('http://localhost:3000/api/test')
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value)
  })

  return new Request(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

export const parseJsonResponse = async (response: Response) => {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

// ============================================================================
// Wait Utilities
// ============================================================================

export const waitFor = async (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
) => {
  const { timeout = 5000, interval = 100 } = options
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return true
    }
    await waitFor(interval)
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}
