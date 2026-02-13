import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/')
    
    // Check if the page loaded successfully
    await expect(page).toHaveTitle(/Aura/)
  })

  test('should have navigation links', async ({ page }) => {
    await page.goto('/')
    
    // Check for main navigation
    const nav = page.locator('nav, header')
    await expect(nav).toBeVisible()
  })

  test('should have sign in button for unauthenticated users', async ({ page }) => {
    await page.goto('/')
    
    // Look for sign in/login button or link
    const signInButton = page.getByRole('link', { name: /sign in|login|get started/i })
    await expect(signInButton).toBeVisible()
  })
})

test.describe('Authentication Flow', () => {
  test('should redirect to sign in page when accessing dashboard unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')
    
    // Should redirect to sign-in or show authentication required
    await expect(page).toHaveURL(/sign-in|login/)
  })

  test('should show sign in page', async ({ page }) => {
    await page.goto('/sign-in')
    
    // Should show the sign in form
    await expect(page).toHaveURL(/sign-in/)
  })
})

test.describe('Navigation', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    
    // Page should load without errors on mobile
    await expect(page).toHaveTitle(/Aura/)
  })

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    
    await expect(page).toHaveTitle(/Aura/)
  })

  test('should be responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    
    await expect(page).toHaveTitle(/Aura/)
  })
})

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/')
    
    // Check that there's at least one heading
    const headings = page.locator('h1, h2, h3, h4, h5, h6')
    await expect(headings.first()).toBeVisible()
  })

  test('should have alt text on images', async ({ page }) => {
    await page.goto('/')
    
    // All images should have alt attributes
    const images = page.locator('img')
    const count = await images.count()
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      expect(alt).not.toBeNull()
    }
  })

  test('should have proper link text', async ({ page }) => {
    await page.goto('/')
    
    // Links should have text content
    const links = page.locator('a')
    const count = await links.count()
    
    for (let i = 0; i < count; i++) {
      const link = links.nth(i)
      const text = await link.textContent()
      const ariaLabel = await link.getAttribute('aria-label')
      
      // Link should have either visible text or aria-label
      expect(text || ariaLabel).toBeTruthy()
    }
  })
})
