import { expect, test } from '@playwright/test'
import { assertArabic, assertEnglish, switchTo } from '../_helpers'

// Client-only (server: false) + context, persisted in localStorage. No cookies,
// no URL prefix. The locale survives reloads via localStorage.
test.describe('client-context', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) =>
      console.log('BROWSER CONSOLE (client-context):', msg.text()),
    )
    page.on('pageerror', (err) =>
      console.error('BROWSER ERROR (client-context):', err),
    )
  })

  test('serves the navigator/default locale at "/"', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    // Headless Chrome defaults to navigator.language en-US -> en.
    await assertEnglish(page)
  })

  test('switching locale keeps the path and persists via localStorage across reload', async ({
    page,
  }) => {
    await page.goto('/')
    await assertEnglish(page)

    await switchTo(page, 'ar')
    await expect(page).toHaveURL(/\/$/)
    await assertArabic(page)

    // localStorage persistence: reload keeps Arabic (no cookie involved).
    await page.reload()
    await expect(page).toHaveURL(/\/$/)
    await assertArabic(page)
  })

  test('a returning visit with localStorage set uses the persisted locale', async ({
    page,
  }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('locale', 'ar'))
    await page.reload()
    await assertArabic(page)
  })

  test('does not redirect or touch ignored paths', async ({ page }) => {
    await page.goto('/api/data')
    await expect(page).toHaveURL(/\/api\/data$/)
  })
})
