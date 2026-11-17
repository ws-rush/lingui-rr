import {
  assertAboutArabic,
  assertAboutEnglish,
  assertArabic,
  assertEnglish,
  expect,
  switchTo,
  test,
} from '../_helpers'

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

  test('does not redirect ignored paths and serves /api/data JSON', async ({
    page,
  }) => {
    const response = await page.goto('/api/data')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/api\/data$/)
    expect(await response?.json()).toEqual({ ok: true })
  })

  test('navigates between home and /about via Link preserving active locale', async ({
    page,
  }) => {
    await page.goto('/ar')
    await assertArabic(page)

    await page.getByTestId('about-link').click()
    await expect(page).toHaveURL(/\/ar\/about$/)
    await assertAboutArabic(page)

    await page.getByTestId('home-link').click()
    await expect(page).toHaveURL(/\/ar\/?$/)
    await assertArabic(page)
  })

  test('preserves query string and hash when redirecting unprefixed /about', async ({
    page,
  }) => {
    await page.goto('/about?tab=1#sec')
    await expect(page).toHaveURL(/\/en\/about\?tab=1#sec$/)
    await assertAboutEnglish(page)
  })
})
