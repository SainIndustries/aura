import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

import {
  listEmails,
  readEmail,
  sendEmail,
  listCalendarEvents,
  createCalendarEvent,
} from '@/lib/integrations/google-api'

const ACCESS_TOKEN = 'test-access-token'

// Helper to build a successful JSON response
function okJson(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Helper to build a failing response
function errorResponse(status: number, body: string): Response {
  return new Response(body, { status, statusText: 'Error' })
}

describe('Google API service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================================================
  // listEmails
  // ==========================================================================
  describe('listEmails', () => {
    it('returns email summaries for listed messages', async () => {
      // First call: list message IDs
      mockFetch.mockResolvedValueOnce(
        okJson({
          messages: [{ id: 'msg-1' }, { id: 'msg-2' }],
        })
      )

      // Second & third calls: metadata for each message
      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'msg-1',
          snippet: 'Hey there...',
          payload: {
            headers: [
              { name: 'Subject', value: 'Meeting tomorrow' },
              { name: 'From', value: 'alice@example.com' },
              { name: 'Date', value: 'Mon, 10 Feb 2026 09:00:00 -0500' },
            ],
          },
        })
      )
      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'msg-2',
          snippet: 'Please review...',
          payload: {
            headers: [
              { name: 'Subject', value: 'PR Review' },
              { name: 'From', value: 'bob@example.com' },
              { name: 'Date', value: 'Mon, 10 Feb 2026 10:00:00 -0500' },
            ],
          },
        })
      )

      const result = await listEmails(ACCESS_TOKEN)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'msg-1',
        subject: 'Meeting tomorrow',
        from: 'alice@example.com',
        date: 'Mon, 10 Feb 2026 09:00:00 -0500',
        snippet: 'Hey there...',
      })
      expect(result[1]).toEqual({
        id: 'msg-2',
        subject: 'PR Review',
        from: 'bob@example.com',
        date: 'Mon, 10 Feb 2026 10:00:00 -0500',
        snippet: 'Please review...',
      })

      // First fetch: list messages
      expect(mockFetch).toHaveBeenCalledTimes(3)
      const listUrl = mockFetch.mock.calls[0][0] as string
      expect(listUrl).toContain('gmail.googleapis.com/gmail/v1/users/me/messages')
      expect(listUrl).toContain('maxResults=10')

      // Verify authorization header
      const listInit = mockFetch.mock.calls[0][1]
      expect(listInit.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)
    })

    it('returns empty array when no messages exist', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ messages: undefined }))

      const result = await listEmails(ACCESS_TOKEN)

      expect(result).toEqual([])
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('passes query parameter to Gmail API', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ messages: [] }))

      await listEmails(ACCESS_TOKEN, 'is:unread from:boss@company.com', 5)

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('q=is%3Aunread+from%3Aboss%40company.com')
      expect(url).toContain('maxResults=5')
    })

    it('uses (no subject) when Subject header is missing', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ messages: [{ id: 'msg-x' }] }))
      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'msg-x',
          snippet: '',
          payload: { headers: [] },
        })
      )

      const result = await listEmails(ACCESS_TOKEN)
      expect(result[0].subject).toBe('(no subject)')
    })
  })

  // ==========================================================================
  // readEmail
  // ==========================================================================
  describe('readEmail', () => {
    it('decodes base64url body from text/plain part', async () => {
      const plainText = 'Hello, this is a test email body.'
      const encoded = Buffer.from(plainText)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'msg-1',
          payload: {
            headers: [
              { name: 'Subject', value: 'Test Subject' },
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Date', value: 'Tue, 11 Feb 2026 12:00:00 -0500' },
            ],
            parts: [
              { mimeType: 'text/plain', body: { data: encoded } },
              { mimeType: 'text/html', body: { data: 'ignored' } },
            ],
          },
        })
      )

      const result = await readEmail(ACCESS_TOKEN, 'msg-1')

      expect(result.id).toBe('msg-1')
      expect(result.subject).toBe('Test Subject')
      expect(result.from).toBe('sender@example.com')
      expect(result.to).toBe('recipient@example.com')
      expect(result.body).toBe(plainText)
    })

    it('falls back to text/html and strips tags when no text/plain', async () => {
      const html = '<html><body><p>Hello <b>world</b></p></body></html>'
      const encoded = Buffer.from(html)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'msg-2',
          payload: {
            headers: [
              { name: 'Subject', value: 'HTML Email' },
              { name: 'From', value: 'a@b.com' },
              { name: 'To', value: 'c@d.com' },
              { name: 'Date', value: 'Wed, 12 Feb 2026 08:00:00 -0500' },
            ],
            parts: [
              { mimeType: 'text/html', body: { data: encoded } },
            ],
          },
        })
      )

      const result = await readEmail(ACCESS_TOKEN, 'msg-2')
      // HTML tags should be stripped
      expect(result.body).not.toContain('<p>')
      expect(result.body).not.toContain('<b>')
      expect(result.body).toContain('Hello')
      expect(result.body).toContain('world')
    })

    it('falls back to payload.body.data when no parts', async () => {
      const bodyText = 'Fallback body content'
      const encoded = Buffer.from(bodyText)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'msg-3',
          payload: {
            headers: [
              { name: 'Subject', value: 'Simple' },
              { name: 'From', value: 'x@y.com' },
              { name: 'To', value: 'z@w.com' },
              { name: 'Date', value: 'Thu, 13 Feb 2026 09:00:00 -0500' },
            ],
            body: { data: encoded },
          },
        })
      )

      const result = await readEmail(ACCESS_TOKEN, 'msg-3')
      expect(result.body).toBe(bodyText)
    })

    it('truncates long bodies at 3000 chars', async () => {
      const longText = 'A'.repeat(5000)
      const encoded = Buffer.from(longText)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')

      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'msg-4',
          payload: {
            headers: [
              { name: 'Subject', value: 'Long' },
              { name: 'From', value: 'a@b.com' },
              { name: 'To', value: 'c@d.com' },
              { name: 'Date', value: 'Fri, 14 Feb 2026 10:00:00 -0500' },
            ],
            parts: [
              { mimeType: 'text/plain', body: { data: encoded } },
            ],
          },
        })
      )

      const result = await readEmail(ACCESS_TOKEN, 'msg-4')
      expect(result.body.length).toBeLessThanOrEqual(3000 + '\n...(truncated)'.length)
      expect(result.body).toContain('...(truncated)')
    })

    it('uses snippet as last resort when no body data', async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'msg-5',
          snippet: 'Snippet fallback text',
          payload: {
            headers: [
              { name: 'Subject', value: 'No Body' },
              { name: 'From', value: 'a@b.com' },
              { name: 'To', value: 'c@d.com' },
              { name: 'Date', value: 'Sat, 15 Feb 2026 11:00:00 -0500' },
            ],
          },
        })
      )

      const result = await readEmail(ACCESS_TOKEN, 'msg-5')
      expect(result.body).toBe('Snippet fallback text')
    })
  })

  // ==========================================================================
  // sendEmail
  // ==========================================================================
  describe('sendEmail', () => {
    it('builds RFC 2822 message, base64url encodes, and returns messageId', async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({ id: 'sent-msg-1', threadId: 'thread-1' })
      )

      const result = await sendEmail(
        ACCESS_TOKEN,
        'recipient@example.com',
        'Test Subject',
        'Hello, this is the body.'
      )

      expect(result).toEqual({
        success: true,
        messageId: 'sent-msg-1',
      })

      // Verify the POST request
      expect(mockFetch).toHaveBeenCalledTimes(1)
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain('gmail.googleapis.com/gmail/v1/users/me/messages/send')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`)

      // Verify the body was base64url encoded
      const body = JSON.parse(init.body)
      expect(body.raw).toBeDefined()
      // Verify no standard base64 chars remain that should be url-safe
      expect(body.raw).not.toMatch(/[+/=]/)

      // Decode and verify RFC 2822 structure
      const decoded = Buffer.from(
        body.raw.replace(/-/g, '+').replace(/_/g, '/'),
        'base64'
      ).toString('utf-8')
      expect(decoded).toContain('To: recipient@example.com')
      expect(decoded).toContain('Subject: Test Subject')
      expect(decoded).toContain('Content-Type: text/plain; charset="UTF-8"')
      expect(decoded).toContain('Hello, this is the body.')
      // RFC 2822 uses \r\n
      expect(decoded).toContain('\r\n')
    })
  })

  // ==========================================================================
  // listCalendarEvents
  // ==========================================================================
  describe('listCalendarEvents', () => {
    it('returns events array with mapped fields', async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          items: [
            {
              id: 'event-1',
              summary: 'Team Standup',
              start: { dateTime: '2026-02-14T09:00:00-05:00' },
              end: { dateTime: '2026-02-14T09:30:00-05:00' },
              description: 'Daily standup',
              attendees: [{ email: 'a@b.com' }, { email: 'c@d.com' }],
              htmlLink: 'https://calendar.google.com/event/event-1',
            },
          ],
        })
      )

      const result = await listCalendarEvents(ACCESS_TOKEN)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'event-1',
        summary: 'Team Standup',
        start: '2026-02-14T09:00:00-05:00',
        end: '2026-02-14T09:30:00-05:00',
        description: 'Daily standup',
        attendees: ['a@b.com', 'c@d.com'],
        htmlLink: 'https://calendar.google.com/event/event-1',
      })
    })

    it('handles time range parameters', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ items: [] }))

      await listCalendarEvents(
        ACCESS_TOKEN,
        '2026-02-14T00:00:00Z',
        '2026-02-21T00:00:00Z',
        5
      )

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('timeMin=2026-02-14T00%3A00%3A00Z')
      expect(url).toContain('timeMax=2026-02-21T00%3A00%3A00Z')
      expect(url).toContain('maxResults=5')
      expect(url).toContain('singleEvents=true')
      expect(url).toContain('orderBy=startTime')
    })

    it('defaults timeMin to today when no time range specified', async () => {
      mockFetch.mockResolvedValueOnce(okJson({ items: [] }))

      await listCalendarEvents(ACCESS_TOKEN)

      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('timeMin=')
      // Should contain a valid ISO string for today
      const params = new URLSearchParams(url.split('?')[1])
      const timeMin = params.get('timeMin')!
      const parsed = new Date(timeMin)
      expect(parsed.getTime()).not.toBeNaN()
    })

    it('returns empty array when no events exist', async () => {
      mockFetch.mockResolvedValueOnce(okJson({}))

      const result = await listCalendarEvents(ACCESS_TOKEN)
      expect(result).toEqual([])
    })

    it('uses date field when dateTime is not present (all-day events)', async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          items: [
            {
              id: 'event-allday',
              summary: 'Holiday',
              start: { date: '2026-02-16' },
              end: { date: '2026-02-17' },
            },
          ],
        })
      )

      const result = await listCalendarEvents(ACCESS_TOKEN)
      expect(result[0].start).toBe('2026-02-16')
      expect(result[0].end).toBe('2026-02-17')
    })
  })

  // ==========================================================================
  // createCalendarEvent
  // ==========================================================================
  describe('createCalendarEvent', () => {
    it('creates event with attendees and returns event link', async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'new-event-1',
          htmlLink: 'https://calendar.google.com/event/new-event-1',
          summary: 'Project Kickoff',
          start: { dateTime: '2026-02-15T14:00:00-05:00' },
          end: { dateTime: '2026-02-15T15:00:00-05:00' },
        })
      )

      const result = await createCalendarEvent(ACCESS_TOKEN, {
        summary: 'Project Kickoff',
        startDateTime: '2026-02-15T14:00:00-05:00',
        endDateTime: '2026-02-15T15:00:00-05:00',
        description: 'Kickoff meeting for new project',
        attendees: ['alice@example.com', 'bob@example.com'],
      })

      expect(result).toEqual({
        id: 'new-event-1',
        htmlLink: 'https://calendar.google.com/event/new-event-1',
        summary: 'Project Kickoff',
        start: '2026-02-15T14:00:00-05:00',
        end: '2026-02-15T15:00:00-05:00',
      })

      // Verify POST body
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toContain('googleapis.com/calendar/v3/calendars/primary/events')
      expect(init.method).toBe('POST')

      const body = JSON.parse(init.body)
      expect(body.summary).toBe('Project Kickoff')
      expect(body.start).toEqual({ dateTime: '2026-02-15T14:00:00-05:00' })
      expect(body.end).toEqual({ dateTime: '2026-02-15T15:00:00-05:00' })
      expect(body.description).toBe('Kickoff meeting for new project')
      expect(body.attendees).toEqual([
        { email: 'alice@example.com' },
        { email: 'bob@example.com' },
      ])
    })

    it('creates event without optional fields', async () => {
      mockFetch.mockResolvedValueOnce(
        okJson({
          id: 'new-event-2',
          htmlLink: 'https://calendar.google.com/event/new-event-2',
          summary: 'Quick sync',
          start: { dateTime: '2026-02-15T10:00:00-05:00' },
          end: { dateTime: '2026-02-15T10:30:00-05:00' },
        })
      )

      await createCalendarEvent(ACCESS_TOKEN, {
        summary: 'Quick sync',
        startDateTime: '2026-02-15T10:00:00-05:00',
        endDateTime: '2026-02-15T10:30:00-05:00',
      })

      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.description).toBeUndefined()
      expect(body.attendees).toBeUndefined()
    })
  })

  // ==========================================================================
  // Error handling
  // ==========================================================================
  describe('error handling', () => {
    it('listEmails throws on non-OK fetch response', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401, 'Invalid credentials'))

      await expect(listEmails(ACCESS_TOKEN)).rejects.toThrow(
        'Google API error (401): Invalid credentials'
      )
    })

    it('readEmail throws on non-OK fetch response', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(404, 'Message not found'))

      await expect(readEmail(ACCESS_TOKEN, 'bad-id')).rejects.toThrow(
        'Google API error (404): Message not found'
      )
    })

    it('sendEmail throws on non-OK fetch response', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403, 'Insufficient permissions'))

      await expect(
        sendEmail(ACCESS_TOKEN, 'x@y.com', 'Subj', 'Body')
      ).rejects.toThrow('Google API error (403): Insufficient permissions')
    })

    it('listCalendarEvents throws on non-OK fetch response', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500, 'Internal error'))

      await expect(listCalendarEvents(ACCESS_TOKEN)).rejects.toThrow(
        'Google API error (500): Internal error'
      )
    })

    it('createCalendarEvent throws on non-OK fetch response', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(400, 'Bad request'))

      await expect(
        createCalendarEvent(ACCESS_TOKEN, {
          summary: 'Test',
          startDateTime: '2026-02-15T10:00:00Z',
          endDateTime: '2026-02-15T11:00:00Z',
        })
      ).rejects.toThrow('Google API error (400): Bad request')
    })
  })
})
