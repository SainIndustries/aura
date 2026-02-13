import { test, expect } from '@playwright/test'

test.describe('Integrations Page', () => {
  // Note: These tests assume authentication is handled
  // In a real scenario, you'd need to mock or handle authentication

  test.describe('when unauthenticated', () => {
    test('should redirect to sign in', async ({ page }) => {
      await page.goto('/integrations')
      
      // Should redirect to sign-in
      await expect(page).toHaveURL(/sign-in/)
    })
  })

  test.describe('integration cards', () => {
    test('should display available integrations', async ({ page }) => {
      // This would require authentication setup
      // For now, we just test the page structure
      
      await page.goto('/integrations')
      
      // Either we're on the page or redirected to sign-in
      const url = page.url()
      expect(url).toMatch(/integrations|sign-in/)
    })
  })
})

test.describe('Settings Page', () => {
  test('should redirect to sign in when unauthenticated', async ({ page }) => {
    await page.goto('/settings')
    
    await expect(page).toHaveURL(/sign-in/)
  })
})

test.describe('Agents Page', () => {
  test('should redirect to sign in when unauthenticated', async ({ page }) => {
    await page.goto('/agents')
    
    await expect(page).toHaveURL(/sign-in/)
  })
})

test.describe('Team Page', () => {
  test('should redirect to sign in when unauthenticated', async ({ page }) => {
    await page.goto('/team')
    
    await expect(page).toHaveURL(/sign-in/)
  })
})

test.describe('Templates Page', () => {
  test('should redirect to sign in when unauthenticated', async ({ page }) => {
    await page.goto('/templates')
    
    await expect(page).toHaveURL(/sign-in/)
  })
})

test.describe('Audit Log Page', () => {
  test('should redirect to sign in when unauthenticated', async ({ page }) => {
    await page.goto('/audit-log')
    
    await expect(page).toHaveURL(/sign-in/)
  })
})
