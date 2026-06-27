import { expect, test } from '@playwright/test'
import { assertArabic, assertEnglish, switchTo } from '../_helpers'

// SSR + url-prefix (prefixDefaultLocale: true). The server middleware redirects
// unprefixed URLs to the detected/default locale prefix, so `/` -> `/en`.
test.describe('ssr-url-prefix', () => {
  test('redirects unprefixed "/" to the default locale prefix "/en"', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/en\/?$/)
    await assertEnglish(page)
  })

  test('serves a canonical locale prefix directly', async ({ page }) => {
    await page.goto('/ar')
    await expect(page).toHaveURL(/\/ar\/?$/)
    await assertArabic(page)
  })

  test('switching locale rewrites the URL prefix and persists across reload', async ({
    page,
  }) => {
    await page.goto('/en')
    await assertEnglish(page)

    await switchTo(page, 'ar')
    await expect(page).toHaveURL(/\/ar\/?$/)
    await assertArabic(page)

    // Cookie persistence: reload keeps the Arabic locale at /ar.
    await page.reload()
    await expect(page).toHaveURL(/\/ar\/?$/)
    await assertArabic(page)
  })

  test('sets <html lang/dir> correctly for each locale', async ({ page }) => {
    await page.goto('/en')
    await assertEnglish(page)
    await page.goto('/ar')
    await assertArabic(page)
  })

  test('redirects unsupported locale-like prefixes to detected/default locale', async ({
    page,
  }) => {
    await page.goto('/fr')
    await expect(page).toHaveURL(/\/en\/?$/)
    await assertEnglish(page)
  })

  test('handles regional locale fallback by redirecting to base supported locale', async ({
    page,
  }) => {
    await page.goto('/en-US')
    await expect(page).toHaveURL(/\/en\/?$/)
    await assertEnglish(page)
  })

  test('does not redirect ignored paths', async ({ page }) => {
    await page.goto('/api/data')
    await expect(page).toHaveURL(/\/api\/data$/)
  })
})
