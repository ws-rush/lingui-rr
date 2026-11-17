import { test as base, expect, type Locator, type Page } from '@playwright/test'

// Extend Playwright's test with an auto-attached pageerror guard so every test
// fails if any uncaught exception fires in the browser.
export const test = base.extend<{ pageErrors: Error[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: Error[] = []
      page.on('pageerror', (err) => {
        errors.push(err)
      })
      await use(errors)
      expect(
        errors,
        `Uncaught pageerror(s): ${errors.map((e) => e.message).join('; ')}`,
      ).toHaveLength(0)
    },
    { auto: true },
  ],
})

export { expect }

// Shared locators + assertions for the fixture pages. The home fixture renders:
//   [data-testid=greeting]    translated greeting
//   [data-testid=about-link]  Link to /about
//   [data-testid=locale]      active locale code
//   [data-testid=dir]         active locale direction
//   [data-testid=switch-en]   submit /change-locale with locale=en
//   [data-testid=switch-ar]   submit /change-locale with locale=ar
export const greeting = (page: Page): Locator => page.getByTestId('greeting')
export const aboutTitle = (page: Page): Locator =>
  page.getByTestId('about-title')
export const aboutBody = (page: Page): Locator => page.getByTestId('about-body')
export const localeText = (page: Page): Locator => page.getByTestId('locale')
export const dirText = (page: Page): Locator => page.getByTestId('dir')

const HOME_COPY = {
  en: { greeting: 'Hello from lingui-rr', lang: 'en', dir: 'ltr' },
  ar: { greeting: 'مرحبا من lingui-rr', lang: 'ar', dir: 'rtl' },
} as const

const ABOUT_COPY = {
  en: {
    title: 'About lingui-rr',
    body: 'About page content',
    lang: 'en',
    dir: 'ltr',
  },
  ar: {
    title: 'حول lingui-rr',
    body: 'محتوى صفحة حول',
    lang: 'ar',
    dir: 'rtl',
  },
} as const

async function assertHomeLocale(page: Page, locale: 'en' | 'ar') {
  const copy = HOME_COPY[locale]
  await page.waitForSelector('[data-testid=greeting]')
  const text = await greeting(page).textContent()
  if (text !== copy.greeting) {
    throw new Error(`expected ${locale} greeting, got: ${text}`)
  }
  await assertHtmlAttrs(page, copy.lang, copy.dir)
  await assertMarkers(page, copy.lang, copy.dir)
}

async function assertAboutLocale(page: Page, locale: 'en' | 'ar') {
  const copy = ABOUT_COPY[locale]
  await page.waitForSelector('[data-testid=about-title]')
  const title = await aboutTitle(page).textContent()
  if (title !== copy.title) {
    throw new Error(`expected ${locale} about title, got: ${title}`)
  }
  const body = await aboutBody(page).textContent()
  if (body !== copy.body) {
    throw new Error(`expected ${locale} about body, got: ${body}`)
  }
  await assertHtmlAttrs(page, copy.lang, copy.dir)
  await assertMarkers(page, copy.lang, copy.dir)
}

// Assert the page shows the English locale: greeting text, <html lang/dir>,
// and the [data-testid=locale]/dir markers.
export async function assertEnglish(page: Page) {
  await assertHomeLocale(page, 'en')
}

export async function assertArabic(page: Page) {
  await assertHomeLocale(page, 'ar')
}

export async function assertAboutEnglish(page: Page) {
  await assertAboutLocale(page, 'en')
}

export async function assertAboutArabic(page: Page) {
  await assertAboutLocale(page, 'ar')
}

export async function assertHtmlAttrs(page: Page, lang: string, dir: string) {
  const htmlLang = await page.locator('html').getAttribute('lang')
  const htmlDir = await page.locator('html').getAttribute('dir')
  if (htmlLang !== lang)
    throw new Error(`expected <html lang="${lang}">, got "${htmlLang}"`)
  if (htmlDir !== dir)
    throw new Error(`expected <html dir="${dir}">, got "${htmlDir}"`)
}

export async function assertMarkers(page: Page, locale: string, dir: string) {
  const loc = await localeText(page).textContent()
  const d = await dirText(page).textContent()
  if (loc !== locale)
    throw new Error(`expected locale marker "${locale}", got "${loc}"`)
  if (d !== dir) throw new Error(`expected dir marker "${dir}", got "${d}"`)
}

// Submit the locale-switch form for the given locale and wait for the
// post-action redirect + root revalidation to settle.
export async function switchTo(page: Page, locale: 'en' | 'ar') {
  await page.getByTestId(`switch-${locale}`).click()
  await page.waitForSelector('[data-testid=greeting]')
}
