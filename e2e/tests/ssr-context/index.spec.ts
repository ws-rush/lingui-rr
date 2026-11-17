import {
  assertAboutArabic,
  assertAboutEnglish,
  assertArabic,
  assertEnglish,
  expect,
  switchTo,
  test,
} from '../_helpers'

// SSR + context. The locale lives in a cookie; URLs never change. React Router
// revalidates after the locale action, while createLinguiShouldRevalidate acts
// as an additional guardrail for the root loader.
test.describe('ssr-context', () => {
  test('serves the default locale at "/" with no URL prefix', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await assertEnglish(page)
  })

  test('switching locale keeps the same path and persists across reload', async ({
    page,
  }) => {
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

  test('a returning visit with a cookie uses the persisted locale', async ({
    context,
    page,
  }) => {
    // Seed the locale cookie directly and confirm the server honors it.
    await context.addCookies([
      { name: 'locale', value: 'ar', url: 'http://127.0.0.1:3102' },
    ])
    await page.goto('/')
    await assertArabic(page)
  })

  test('does not redirect or touch ignored paths and serves /api/data JSON', async ({
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
