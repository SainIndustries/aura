import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createMockUser, createMockAgent, createMockAgentInstance } from '@/test/utils'

// ---------- Shared mock for the LLM create method ----------

const { mockCreate } = vi.hoisted(() => {
  return { mockCreate: vi.fn() }
})

// ---------- Module-level mocks ----------

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/auth/current-user', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      agents: { findMany: vi.fn(), findFirst: vi.fn() },
    },
  },
}))

vi.mock('@/lib/db/schema', () => ({
  agents: {},
  agentInstances: {},
  integrations: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
}))

vi.mock('@/lib/llm-client', () => ({
  getFallbackLLM: vi.fn(),
}))

// ---------- Test data ----------

const mockUser = createMockUser({
  id: 'user-uuid',
  email: 'user@example.com',
})

const mockRunningAgent = createMockAgent({
  id: 'agent-1',
  userId: 'user-uuid',
  name: 'Running Agent',
  status: 'active',
  config: { gatewayToken: 'test-gateway-token' },
})

const mockRunningInstance = createMockAgentInstance({
  id: 'instance-1',
  agentId: 'agent-1',
  status: 'running',
  serverIp: '1.2.3.4',
})

const mockDraftAgent = createMockAgent({
  id: 'agent-2',
  userId: 'user-uuid',
  name: 'Draft Agent',
  status: 'draft',
  config: {},
})

// ---------- Helpers ----------

function buildRequest(messages: { role: string; content: string }[]): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
}

function buildInvalidRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Parse SSE response and extract concatenated content */
async function parseSSEContent(response: Response): Promise<string> {
  const text = await response.text()
  let content = ''
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const payload = line.slice(6).trim()
    if (payload === '[DONE]') continue
    try {
      const parsed = JSON.parse(payload)
      if (parsed.content) content += parsed.content
    } catch {
      // skip malformed lines
    }
  }
  return content
}

/** Create a mock async iterable OpenAI stream (fresh generator each call) */
function createMockLLMStream(content: string) {
  return {
    [Symbol.asyncIterator]() {
      let done = false
      return {
        async next() {
          if (!done) {
            done = true
            return { done: false as const, value: { choices: [{ delta: { content } }] } }
          }
          return { done: true as const, value: undefined }
        },
      }
    },
  }
}

/** Create a mock SSE response for OpenClaw proxy */
function createOpenClawSSEResponse(content: string): Response {
  const data = `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\ndata: [DONE]\n\n`
  return new Response(data, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

// ---------- Mock fetch for OpenClaw proxy ----------
const originalFetch = global.fetch
const mockFetch = vi.fn()

// ---------- Tests ----------

describe('POST /api/chat', () => {
  let savedOpenRouterKey: string | undefined
  let savedOpenAIKey: string | undefined

  beforeEach(async () => {
    vi.clearAllMocks()

    savedOpenRouterKey = process.env.OPENROUTER_API_KEY
    savedOpenAIKey = process.env.OPENAI_API_KEY
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key'

    // Default: rate limit passes
    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      reset: Date.now() + 10000,
    })

    // Default: user is authenticated
    const { getCurrentUser } = await import('@/lib/auth/current-user')
    vi.mocked(getCurrentUser).mockResolvedValue(mockUser as any)

    // Default: no agents (no OpenClaw instance)
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.agents.findMany).mockResolvedValue([])

    // Default: mock LLM client via getFallbackLLM
    mockCreate.mockReturnValue(createMockLLMStream('LLM response here'))
    const { getFallbackLLM } = await import('@/lib/llm-client')
    vi.mocked(getFallbackLLM).mockReturnValue({
      client: { chat: { completions: { create: mockCreate } } } as any,
      model: 'test-model',
    })
  })

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = savedOpenRouterKey
    process.env.OPENAI_API_KEY = savedOpenAIKey
    global.fetch = originalFetch
  })

  // ==========================================================================
  // Rate limiting
  // ==========================================================================
  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkRateLimit).mockResolvedValue({
      success: false,
      limit: 10,
      remaining: 0,
      reset: Date.now() + 10000,
    })

    const { POST } = await import('@/app/api/chat/route')
    const response = await POST(buildRequest([{ role: 'user', content: 'hello' }]))
    const data = await response.json()

    expect(response.status).toBe(429)
    expect(data.error).toContain('Too many requests')
  })

  // ==========================================================================
  // Validation
  // ==========================================================================
  it('returns 400 for invalid messages format', async () => {
    const { POST } = await import('@/app/api/chat/route')
    const response = await POST(buildInvalidRequest({ messages: 'not an array' }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid messages format')
  })

  it('returns 400 when messages is missing', async () => {
    const { POST } = await import('@/app/api/chat/route')
    const response = await POST(buildInvalidRequest({}))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toContain('Invalid messages format')
  })

  // ==========================================================================
  // OpenClaw proxy -- success
  // ==========================================================================
  it('proxies to OpenClaw when user has running instance with gatewayToken', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.agents.findMany).mockResolvedValue([
      {
        ...mockRunningAgent,
        instances: [mockRunningInstance],
      },
    ] as any)

    // Mock fetch to return SSE response
    global.fetch = mockFetch
    mockFetch.mockResolvedValueOnce(createOpenClawSSEResponse('OpenClaw says hello'))

    const { POST } = await import('@/app/api/chat/route')
    const response = await POST(
      buildRequest([{ role: 'user', content: 'What is on my schedule?' }])
    )
    const content = await parseSSEContent(response)

    expect(content).toBe('OpenClaw says hello')

    // Verify fetch was called with the correct OpenClaw URL
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://1.2.3.4/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer test-gateway-token')
    expect(init.headers['Content-Type']).toBe('application/json')

    const body = JSON.parse(init.body)
    expect(body.model).toBe('openclaw')
    expect(body.stream).toBe(true)
    // Messages should include system prompt + user messages
    expect(body.messages[0].role).toBe('system')
    expect(body.messages[body.messages.length - 1].content).toBe('What is on my schedule?')
  })

  // ==========================================================================
  // OpenClaw proxy -- falls back on failure
  // ==========================================================================
  it('falls back to direct LLM when OpenClaw proxy fails', async () => {
    const { db } = await import('@/lib/db')
    vi.mocked(db.query.agents.findMany).mockResolvedValue([
      {
        ...mockRunningAgent,
        instances: [mockRunningInstance],
      },
    ] as any)

    // Mock fetch to simulate OpenClaw failure
    global.fetch = mockFetch
    mockFetch.mockResolvedValueOnce(
      new Response('Gateway timeout', { status: 502 })
    )

    // The fallback LLM streaming call should succeed
    mockCreate.mockReturnValue(createMockLLMStream('Fallback LLM response'))

    const { POST } = await import('@/app/api/chat/route')
    const response = await POST(
      buildRequest([{ role: 'user', content: 'test message' }])
    )
    const content = await parseSSEContent(response)

    expect(content).toBe('Fallback LLM response')
    expect(mockCreate).toHaveBeenCalled()
  })

  // ==========================================================================
  // No running instance -- uses direct LLM
  // ==========================================================================
  it('falls back to direct LLM when user has no running instance', async () => {
    const { db } = await import('@/lib/db')
    // Agent exists but instance is not running
    vi.mocked(db.query.agents.findMany).mockResolvedValue([
      {
        ...mockDraftAgent,
        instances: [],
      },
    ] as any)

    mockCreate.mockReturnValue(createMockLLMStream('Direct LLM response'))

    const { POST } = await import('@/app/api/chat/route')
    const response = await POST(
      buildRequest([{ role: 'user', content: 'summarize my day' }])
    )
    const content = await parseSSEContent(response)

    expect(content).toBe('Direct LLM response')
  })

  // ==========================================================================
  // No user -- still works via direct LLM
  // ==========================================================================
  it('uses direct LLM when user is not authenticated', async () => {
    const { getCurrentUser } = await import('@/lib/auth/current-user')
    vi.mocked(getCurrentUser).mockResolvedValue(null)

    mockCreate.mockReturnValue(createMockLLMStream('Anon response'))

    const { POST } = await import('@/app/api/chat/route')
    const response = await POST(
      buildRequest([{ role: 'user', content: 'hi there' }])
    )
    const content = await parseSSEContent(response)

    expect(content).toBe('Anon response')
  })

  // ==========================================================================
  // Fallback responses for common keywords (LLM fails -> getFallbackResponse)
  // ==========================================================================
  describe('fallback responses for common keywords', () => {
    // These tests make the LLM fail so the catch block triggers getFallbackResponse.
    // The route wraps streamFromFallbackLLM in a try-catch that falls back to
    // keyword-based responses when the LLM is unavailable.

    beforeEach(() => {
      mockCreate.mockImplementation(() => {
        throw new Error('LLM unavailable')
      })
    })

    async function getFallbackForMessage(content: string): Promise<string> {
      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(buildRequest([{ role: 'user', content }]))
      return parseSSEContent(response)
    }

    it('returns greeting fallback for "hello"', async () => {
      const message = await getFallbackForMessage('hello')
      expect(message).toContain('help')
      expect(message).toContain('emails')
    })

    it('returns email fallback for "email"', async () => {
      const message = await getFallbackForMessage('check my email')
      expect(message).toContain('email')
    })

    it('returns calendar fallback for "calendar"', async () => {
      const message = await getFallbackForMessage('show my calendar')
      expect(message).toContain('calendar')
    })

    it('returns scheduling fallback for "meeting"', async () => {
      const message = await getFallbackForMessage('schedule a meeting')
      expect(message).toContain('scheduling')
    })

    it('returns task fallback for "todo"', async () => {
      const message = await getFallbackForMessage('add a todo')
      expect(message).toContain('todo')
    })

    it('returns help fallback for "help"', async () => {
      const message = await getFallbackForMessage('help')
      expect(message).toContain('Email')
    })

    it('returns generic fallback for unknown content', async () => {
      const message = await getFallbackForMessage('xyzzy quantum flux')
      expect(message).toBeTruthy()
      expect(message.length).toBeGreaterThan(10)
    })
  })

  // ==========================================================================
  // No LLM configured (resetModules test -- placed last to avoid side effects)
  // ==========================================================================
  describe('no LLM configured', () => {
    it('returns fallback response when no LLM is configured', async () => {
      // getFallbackLLM returns null when no API keys are set
      const { getFallbackLLM } = await import('@/lib/llm-client')
      vi.mocked(getFallbackLLM).mockReturnValue(null)

      const { POST } = await import('@/app/api/chat/route')
      const response = await POST(
        buildRequest([{ role: 'user', content: 'hello' }])
      )
      const content = await parseSSEContent(response)

      expect(content).toBeTruthy()
      // The fallback for "hello" includes greeting about emails/help
      expect(content).toContain('help')
    })
  })
})
