import { expect, test } from '@playwright/test'
import { assertArabic, assertEnglish, switchTo } from '../_helpers'

// SSR + context. The locale lives in a cookie; URLs never change. React Router
// revalidates after the locale action, while createLinguiShouldRevalidate acts
// as an additional guardrail for the root loader.
test.describe('ssr-context', () => {
  test('serves the default locale at "/" with no URL prefix', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await assertEnglish(page)
  })

  test('switching locale keeps the same path and persists across reload', async ({ page }) => {
    await page.goto('/')
    await assertEnglish(page)

    await switchTo(page, 'ar')
    // URL is unchanged in context mode.
    await expect(page).toHaveURL(/\/$/)
    await assertArabic(page)

    // Cookie persistence: reload keeps Arabic on the same path.
    await page.reload()
    await expect(page).toHaveURL(/\/$/)
    await assertArabic(page)
  })

  test('a returning visit with a cookie uses the persisted locale', async ({ context, page }) => {
    // Seed the locale cookie directly and confirm the server honors it.
    await context.addCookies([{ name: 'locale', value: 'ar', url: 'http://127.0.0.1:3102' }])
    await page.goto('/')
    await assertArabic(page)
  })

  test('does not redirect or touch ignored paths', async ({ page }) => {
    await page.goto('/api/data')
    await expect(page).toHaveURL(/\/api\/data$/)
  })
})
