import { expect, test } from '@playwright/test'
import { assertArabic, assertEnglish, switchTo } from '../_helpers'

// Client-only (server: false) + url-prefix with prefixDefaultLocale: false.
// The default locale is hidden (`/` is English); `/ar` is Arabic. The client
// middleware runs in the browser.
test.describe('client-url-prefix', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE (client-url-prefix):', msg.text()))
    page.on('pageerror', err => console.error('BROWSER ERROR (client-url-prefix):', err))
  })

  test('serves the hidden default locale at "/"', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await assertEnglish(page)
  })

  test('serves a non-default locale at its prefixed URL', async ({ page }) => {
    await page.goto('/ar')
    await expect(page).toHaveURL(/\/ar\/?$/)
    await assertArabic(page)
  })

  test('switching locale rewrites the prefix and persists across reload', async ({ page }) => {
    await page.goto('/')
    await assertEnglish(page)

    await switchTo(page, 'ar')
    await expect(page).toHaveURL(/\/ar\/?$/)
    await assertArabic(page)

    // Client cookie persistence: reload at /ar keeps Arabic.
    await page.reload()
    await expect(page).toHaveURL(/\/ar\/?$/)
    await assertArabic(page)
  })

  test('redirects to clean URL when default locale is explicitly prefixed', async ({ page }) => {
    await page.goto('/en')
    await expect(page).toHaveURL(/\/$/)
    await assertEnglish(page)
  })

  test('a returning visit with a client cookie redirects to the persisted locale', async ({ context, page }) => {
    // Seed the client cookie directly.
    await context.addCookies([{ name: 'locale', value: 'ar', url: 'http://127.0.0.1:3103' }])
    await page.goto('/')
    await expect(page).toHaveURL(/\/ar\/?$/)
    await assertArabic(page)
  })

  test('handles regional locale fallback by redirecting to base supported locale', async ({ page }) => {
    await page.goto('/ar-EG')
    await expect(page).toHaveURL(/\/ar\/?$/)
    await assertArabic(page)
  })

  test('does not redirect ignored paths', async ({ page }) => {
    await page.goto('/api/data')
    await expect(page).toHaveURL(/\/api\/data$/)
  })
})
