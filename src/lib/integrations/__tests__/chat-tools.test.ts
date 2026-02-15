import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the google-api module
vi.mock('@/lib/integrations/google-api', () => ({
  listEmails: vi.fn(),
  readEmail: vi.fn(),
  sendEmail: vi.fn(),
  listCalendarEvents: vi.fn(),
  createCalendarEvent: vi.fn(),
}))

import { GOOGLE_TOOLS, executeToolCall } from '@/lib/integrations/chat-tools'

const ACCESS_TOKEN = 'test-access-token'

describe('Chat Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // GOOGLE_TOOLS definitions
  // ==========================================================================
  describe('GOOGLE_TOOLS', () => {
    it('has 5 tool definitions', () => {
      expect(GOOGLE_TOOLS).toHaveLength(5)
    })

    it('has correct tool names', () => {
      const names = GOOGLE_TOOLS.map((t) => t.function.name)
      expect(names).toEqual([
        'list_emails',
        'read_email',
        'send_email',
        'list_calendar_events',
        'create_calendar_event',
      ])
    })

    it('all tools have type "function"', () => {
      for (const tool of GOOGLE_TOOLS) {
        expect(tool.type).toBe('function')
      }
    })

    it('all tools have descriptions and parameters', () => {
      for (const tool of GOOGLE_TOOLS) {
        expect(tool.function.description).toBeTruthy()
        expect(tool.function.parameters).toBeDefined()
        expect(tool.function.parameters.type).toBe('object')
      }
    })
  })

  // ==========================================================================
  // executeToolCall — list_emails
  // ==========================================================================
  describe('executeToolCall — list_emails', () => {
    it('calls listEmails with correct arguments', async () => {
      const { listEmails } = await import('@/lib/integrations/google-api')
      const mockResult = [
        { id: 'msg-1', subject: 'Hello', from: 'a@b.com', date: '2026-02-14', snippet: '...' },
      ]
      vi.mocked(listEmails).mockResolvedValue(mockResult)

      const result = await executeToolCall(
        'list_emails',
        { query: 'is:unread', max_results: 5 },
        ACCESS_TOKEN
      )

      expect(listEmails).toHaveBeenCalledWith(ACCESS_TOKEN, 'is:unread', 5)
      expect(result).toEqual(mockResult)
    })

    it('defaults max_results to 10 when not provided', async () => {
      const { listEmails } = await import('@/lib/integrations/google-api')
      vi.mocked(listEmails).mockResolvedValue([])

      await executeToolCall('list_emails', {}, ACCESS_TOKEN)

      expect(listEmails).toHaveBeenCalledWith(ACCESS_TOKEN, undefined, 10)
    })

    it('caps max_results at 20', async () => {
      const { listEmails } = await import('@/lib/integrations/google-api')
      vi.mocked(listEmails).mockResolvedValue([])

      await executeToolCall('list_emails', { max_results: 50 }, ACCESS_TOKEN)

      expect(listEmails).toHaveBeenCalledWith(ACCESS_TOKEN, undefined, 20)
    })
  })

  // ==========================================================================
  // executeToolCall — read_email
  // ==========================================================================
  describe('executeToolCall — read_email', () => {
    it('calls readEmail with message_id', async () => {
      const { readEmail } = await import('@/lib/integrations/google-api')
      const mockResult = {
        id: 'msg-1',
        subject: 'Test',
        from: 'a@b.com',
        to: 'c@d.com',
        date: '2026-02-14',
        body: 'Email body content',
      }
      vi.mocked(readEmail).mockResolvedValue(mockResult)

      const result = await executeToolCall(
        'read_email',
        { message_id: 'msg-1' },
        ACCESS_TOKEN
      )

      expect(readEmail).toHaveBeenCalledWith(ACCESS_TOKEN, 'msg-1')
      expect(result).toEqual(mockResult)
    })
  })

  // ==========================================================================
  // executeToolCall — send_email
  // ==========================================================================
  describe('executeToolCall — send_email', () => {
    it('calls sendEmail with to, subject, body', async () => {
      const { sendEmail } = await import('@/lib/integrations/google-api')
      vi.mocked(sendEmail).mockResolvedValue({ success: true, messageId: 'sent-1' })

      const result = await executeToolCall(
        'send_email',
        { to: 'recipient@example.com', subject: 'Hello', body: 'Hi there' },
        ACCESS_TOKEN
      )

      expect(sendEmail).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        'recipient@example.com',
        'Hello',
        'Hi there'
      )
      expect(result).toEqual({ success: true, messageId: 'sent-1' })
    })
  })

  // ==========================================================================
  // executeToolCall — list_calendar_events
  // ==========================================================================
  describe('executeToolCall — list_calendar_events', () => {
    it('calls listCalendarEvents with time range and max_results', async () => {
      const { listCalendarEvents } = await import('@/lib/integrations/google-api')
      const mockEvents = [
        {
          id: 'event-1',
          summary: 'Meeting',
          start: '2026-02-14T09:00:00Z',
          end: '2026-02-14T10:00:00Z',
        },
      ]
      vi.mocked(listCalendarEvents).mockResolvedValue(mockEvents)

      const result = await executeToolCall(
        'list_calendar_events',
        {
          time_min: '2026-02-14T00:00:00Z',
          time_max: '2026-02-15T00:00:00Z',
          max_results: 5,
        },
        ACCESS_TOKEN
      )

      expect(listCalendarEvents).toHaveBeenCalledWith(
        ACCESS_TOKEN,
        '2026-02-14T00:00:00Z',
        '2026-02-15T00:00:00Z',
        5
      )
      expect(result).toEqual(mockEvents)
    })

    it('defaults max_results to 10 and caps at 25', async () => {
      const { listCalendarEvents } = await import('@/lib/integrations/google-api')
      vi.mocked(listCalendarEvents).mockResolvedValue([])

      // No max_results defaults to 10
      await executeToolCall('list_calendar_events', {}, ACCESS_TOKEN)
      expect(listCalendarEvents).toHaveBeenCalledWith(ACCESS_TOKEN, undefined, undefined, 10)

      vi.clearAllMocks()

      // max_results > 25 should be capped at 25
      await executeToolCall('list_calendar_events', { max_results: 100 }, ACCESS_TOKEN)
      expect(listCalendarEvents).toHaveBeenCalledWith(ACCESS_TOKEN, undefined, undefined, 25)
    })
  })

  // ==========================================================================
  // executeToolCall — create_calendar_event
  // ==========================================================================
  describe('executeToolCall — create_calendar_event', () => {
    it('calls createCalendarEvent with correct field mapping', async () => {
      const { createCalendarEvent } = await import('@/lib/integrations/google-api')
      const mockResult = {
        id: 'new-event-1',
        htmlLink: 'https://calendar.google.com/event/new-event-1',
        summary: 'Team Lunch',
        start: '2026-02-15T12:00:00-05:00',
        end: '2026-02-15T13:00:00-05:00',
      }
      vi.mocked(createCalendarEvent).mockResolvedValue(mockResult)

      const result = await executeToolCall(
        'create_calendar_event',
        {
          summary: 'Team Lunch',
          start_date_time: '2026-02-15T12:00:00-05:00',
          end_date_time: '2026-02-15T13:00:00-05:00',
          description: 'Lunch at the new place',
          attendees: ['alice@example.com', 'bob@example.com'],
        },
        ACCESS_TOKEN
      )

      // Verify the snake_case to camelCase mapping
      expect(createCalendarEvent).toHaveBeenCalledWith(ACCESS_TOKEN, {
        summary: 'Team Lunch',
        startDateTime: '2026-02-15T12:00:00-05:00',
        endDateTime: '2026-02-15T13:00:00-05:00',
        description: 'Lunch at the new place',
        attendees: ['alice@example.com', 'bob@example.com'],
      })
      expect(result).toEqual(mockResult)
    })

    it('works without optional description and attendees', async () => {
      const { createCalendarEvent } = await import('@/lib/integrations/google-api')
      vi.mocked(createCalendarEvent).mockResolvedValue({
        id: 'ev-2',
        htmlLink: 'https://calendar.google.com/event/ev-2',
        summary: 'Solo Focus',
        start: '2026-02-15T14:00:00Z',
        end: '2026-02-15T16:00:00Z',
      })

      await executeToolCall(
        'create_calendar_event',
        {
          summary: 'Solo Focus',
          start_date_time: '2026-02-15T14:00:00Z',
          end_date_time: '2026-02-15T16:00:00Z',
        },
        ACCESS_TOKEN
      )

      expect(createCalendarEvent).toHaveBeenCalledWith(ACCESS_TOKEN, {
        summary: 'Solo Focus',
        startDateTime: '2026-02-15T14:00:00Z',
        endDateTime: '2026-02-15T16:00:00Z',
        description: undefined,
        attendees: undefined,
      })
    })
  })

  // ==========================================================================
  // Unknown tool
  // ==========================================================================
  describe('unknown tool', () => {
    it('returns error object for unknown tool name', async () => {
      const result = await executeToolCall(
        'nonexistent_tool',
        {},
        ACCESS_TOKEN
      )

      expect(result).toEqual({ error: 'Unknown tool: nonexistent_tool' })
    })
  })

  // ==========================================================================
  // Error handling
  // ==========================================================================
  describe('error handling', () => {
    it('returns error object without throwing when tool execution fails', async () => {
      const { listEmails } = await import('@/lib/integrations/google-api')
      vi.mocked(listEmails).mockRejectedValue(
        new Error('Google API error (401): Invalid credentials')
      )

      const result = await executeToolCall('list_emails', {}, ACCESS_TOKEN)

      expect(result).toEqual({
        error: 'Google API error (401): Invalid credentials',
      })
    })

    it('returns generic error message for non-Error exceptions', async () => {
      const { readEmail } = await import('@/lib/integrations/google-api')
      vi.mocked(readEmail).mockRejectedValue('string error')

      const result = await executeToolCall(
        'read_email',
        { message_id: 'msg-1' },
        ACCESS_TOKEN
      )

      expect(result).toEqual({ error: 'Tool execution failed' })
    })

    it('handles errors in sendEmail gracefully', async () => {
      const { sendEmail } = await import('@/lib/integrations/google-api')
      vi.mocked(sendEmail).mockRejectedValue(new Error('Network error'))

      const result = await executeToolCall(
        'send_email',
        { to: 'a@b.com', subject: 'Test', body: 'Hello' },
        ACCESS_TOKEN
      )

      expect(result).toEqual({ error: 'Network error' })
    })
  })
})
