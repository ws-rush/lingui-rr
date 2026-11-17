import {
  assertAboutArabic,
  assertAboutEnglish,
  assertArabic,
  assertEnglish,
  expect,
  switchTo,
  test,
} from '../_helpers'

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

  test('does not redirect or touch ignored paths and renders /api/data cleanly', async ({
    page,
  }) => {
    const response = await page.goto('/api/data')
    expect(response?.status()).toBe(200)
    await expect(page).toHaveURL(/\/api\/data$/)
    await expect(page.getByTestId('api-data')).toHaveText('{"ok":true}')
  })

  test('navigates between home and /about via Link preserving active locale', async ({
    page,
  }) => {
    await page.goto('/')
    await assertEnglish(page)

    await page.getByTestId('about-link').click()
    await expect(page).toHaveURL(/\/about$/)
    await assertAboutEnglish(page)

    await page.getByTestId('home-link').click()
    await expect(page).toHaveURL(/\/$/)
    await assertEnglish(page)

    await switchTo(page, 'ar')
    await assertArabic(page)

    await page.getByTestId('about-link').click()
    await expect(page).toHaveURL(/\/about$/)
    await assertAboutArabic(page)
  })
})
