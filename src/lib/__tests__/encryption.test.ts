import { describe, it, expect, vi, beforeEach } from 'vitest'

// We need to test the encryption module with mocked crypto
describe('Encryption Utilities', () => {
  beforeEach(() => {
    vi.stubEnv('INTEGRATION_ENCRYPTION_KEY', 'test-encryption-key-for-testing-32')
  })

  describe('encryptToken', () => {
    it('should encrypt a token and return a formatted string', async () => {
      // Dynamic import to ensure env is set
      const { encryptToken } = await import('@/lib/integrations/encryption')
      
      const token = 'my-secret-token'
      const encrypted = encryptToken(token)

      // Should be in format: iv:authTag:encrypted
      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/)
      
      // Each encryption should produce different output (due to random IV)
      const encrypted2 = encryptToken(token)
      expect(encrypted).not.toBe(encrypted2)
    })

    it('should handle empty strings', async () => {
      const { encryptToken } = await import('@/lib/integrations/encryption')
      
      const encrypted = encryptToken('')
      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:/)
    })

    it('should handle special characters', async () => {
      const { encryptToken } = await import('@/lib/integrations/encryption')
      
      const token = 'token-with-special-chars!@#$%^&*()_+{}[]|:;<>?'
      const encrypted = encryptToken(token)
      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/)
    })

    it('should handle unicode characters', async () => {
      const { encryptToken } = await import('@/lib/integrations/encryption')
      
      const token = '令牌with日本語'
      const encrypted = encryptToken(token)
      expect(encrypted).toMatch(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/)
    })
  })

  describe('decryptToken', () => {
    it('should decrypt an encrypted token correctly', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/integrations/encryption')
      
      const originalToken = 'my-secret-token-12345'
      const encrypted = encryptToken(originalToken)
      const decrypted = decryptToken(encrypted)

      expect(decrypted).toBe(originalToken)
    })

    it('should handle long tokens', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/integrations/encryption')
      
      const originalToken = 'a'.repeat(10000)
      const encrypted = encryptToken(originalToken)
      const decrypted = decryptToken(encrypted)

      expect(decrypted).toBe(originalToken)
    })

    it('should throw error for invalid encrypted format', async () => {
      const { decryptToken } = await import('@/lib/integrations/encryption')
      
      expect(() => decryptToken('invalid-format')).toThrow()
    })

    it('should throw error for tampered ciphertext', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/integrations/encryption')
      
      const encrypted = encryptToken('test-token')
      const [iv, authTag, ciphertext] = encrypted.split(':')
      const tampered = `${iv}:${authTag}:${'ff'.repeat(ciphertext.length / 2)}`

      expect(() => decryptToken(tampered)).toThrow()
    })

    it('should throw error for tampered auth tag', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/integrations/encryption')
      
      const encrypted = encryptToken('test-token')
      const [iv, , ciphertext] = encrypted.split(':')
      const tampered = `${iv}:${'00'.repeat(16)}:${ciphertext}`

      expect(() => decryptToken(tampered)).toThrow()
    })
  })

  describe('roundtrip encryption', () => {
    it('should correctly encrypt and decrypt multiple tokens', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/integrations/encryption')
      
      const tokens = [
        'access_token_123',
        'refresh_token_456',
        'api_key_789',
        JSON.stringify({ nested: { data: 'value' } }),
      ]

      for (const token of tokens) {
        const encrypted = encryptToken(token)
        const decrypted = decryptToken(encrypted)
        expect(decrypted).toBe(token)
      }
    })
  })
})
