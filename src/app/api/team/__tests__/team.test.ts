import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockUser, createMockTeamMember, createMockTeamInvite } from '@/test/utils'

// Create mock data
const mockUser = createMockUser({
  id: 'owner-uuid',
  email: 'owner@example.com',
  name: 'Team Owner',
})

const mockTeamMembers = [
  createMockTeamMember({
    id: 'member-1',
    userId: 'member-user-1',
    workspaceOwnerId: 'owner-uuid',
    role: 'admin',
  }),
  createMockTeamMember({
    id: 'member-2',
    userId: 'member-user-2',
    workspaceOwnerId: 'owner-uuid',
    role: 'member',
  }),
]

// Mock database
vi.mock('@/lib/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
      teamMembers: {
        findFirst: vi.fn(),
      },
      teamInvites: {
        findFirst: vi.fn(),
      },
    },
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([createMockTeamInvite()]),
  },
}))

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUser: vi.fn(),
}))

describe('Team API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/team', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const { GET } = await import('@/app/api/team/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return team members when authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(mockTeamMembers.map(m => ({
              ...m,
              user: {
                id: m.userId,
                email: `${m.userId}@example.com`,
                name: 'Team Member',
                avatarUrl: null,
              },
            }))),
          }),
        }),
      } as any)

      const { GET } = await import('@/app/api/team/route')
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.members).toBeDefined()
      expect(data.members.length).toBeGreaterThan(0)
      // First member should be the owner
      expect(data.members[0].role).toBe('owner')
    })
  })

  describe('POST /api/team (Create Invite)', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const { POST } = await import('@/app/api/team/route')
      
      const request = new Request('http://localhost:3000/api/team', {
        method: 'POST',
        body: JSON.stringify({ email: 'invite@example.com', role: 'member' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 when email is missing', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { POST } = await import('@/app/api/team/route')
      
      const request = new Request('http://localhost:3000/api/team', {
        method: 'POST',
        body: JSON.stringify({ role: 'member' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Email and role are required')
    })

    it('should return 400 when role is invalid', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { POST } = await import('@/app/api/team/route')
      
      const request = new Request('http://localhost:3000/api/team', {
        method: 'POST',
        body: JSON.stringify({ email: 'invite@example.com', role: 'superadmin' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid role')
    })

    it('should return 400 when inviting yourself', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.users.findFirst).mockResolvedValue({
        ...mockUser,
        id: 'owner-uuid', // Same as current user
      } as any)

      const { POST } = await import('@/app/api/team/route')
      
      const request = new Request('http://localhost:3000/api/team', {
        method: 'POST',
        body: JSON.stringify({ email: 'owner@example.com', role: 'member' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Cannot invite yourself')
    })

    it('should create invite successfully', async () => {
      const { getCurrentUser } = await import('@/lib/auth/current-user')
      vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

      const { db } = await import('@/lib/db')
      vi.mocked(db.query.users.findFirst).mockResolvedValue(undefined)
      vi.mocked(db.query.teamInvites.findFirst).mockResolvedValue(undefined)

      const mockInvite = createMockTeamInvite({
        email: 'newmember@example.com',
        role: 'member',
      })

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInvite]),
        }),
      } as any)

      const { POST } = await import('@/app/api/team/route')
      
      const request = new Request('http://localhost:3000/api/team', {
        method: 'POST',
        body: JSON.stringify({ email: 'newmember@example.com', role: 'member' }),
        headers: { 'Content-Type': 'application/json' },
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.invite).toBeDefined()
      expect(data.invite.email).toBe('newmember@example.com')
    })
  })
})
