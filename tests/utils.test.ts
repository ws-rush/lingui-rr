import { describe, expect, it } from 'vitest'
import {
  matchSupportedLocale,
  normalizeLocaleCode,
  serializeCookie,
  type CookieOptions,
} from '../src/index'
import {
  appendDataSuffix,
  parseAcceptLanguage,
  parseCookie,
  safeRedirectPath,
} from '../src/utils'

describe('locale normalization', () => {
  it('canonicalizes BCP-47-ish casing', () => {
    expect(normalizeLocaleCode('en-us')).toBe('en-US')
    expect(normalizeLocaleCode('ZH-hant-tw')).toBe('zh-Hant-TW')
  })

  it('normalizes underscore-separated locale tags', () => {
    expect(normalizeLocaleCode('en_us')).toBe('en-US')
    expect(normalizeLocaleCode('en_US')).toBe('en-US')
    expect(normalizeLocaleCode('zh_hant_tw')).toBe('zh-Hant-TW')
  })

  it('falls back regional locale to base language', () => {
    expect(matchSupportedLocale('en-US', ['en', 'ar'], 'ar')).toBe('en')
    expect(matchSupportedLocale('ar-EG', ['en', 'ar'], 'en')).toBe('ar')
    expect(matchSupportedLocale('fr-FR', ['en', 'ar'], 'en')).toBe('en')
    expect(matchSupportedLocale('zh-Hant-TW', ['zh-Hant', 'en'], 'en')).toBe(
      'zh-Hant',
    )
    expect(matchSupportedLocale(null, ['en'], 'en')).toBe('en')
  })

  it('matches underscore-separated locale tags against supported locales', () => {
    expect(matchSupportedLocale('ar_eg', ['en', 'ar'], 'en')).toBe('ar')
    expect(matchSupportedLocale('en_US', ['en-US', 'ar'], 'ar')).toBe('en-US')
  })
})

describe('cookie parsing', () => {
  it('parses cookies exactly matching the name', () => {
    expect(parseCookie('locale=en', 'locale')).toBe('en')
    expect(parseCookie('other_locale=ar; locale=en', 'locale')).toBe('en')
    expect(parseCookie('locale=en; other_locale=ar', 'locale')).toBe('en')
  })

  it('does not do prefix or substring matching on cookie names', () => {
    expect(parseCookie('locale_suffix=en', 'locale')).toBeNull()
    expect(parseCookie('prefix_locale=en', 'locale')).toBeNull()
  })

  it('tolerates spaces around name and value', () => {
    expect(parseCookie('locale = en', 'locale')).toBe('en')
    expect(parseCookie('  locale  =  en  ', 'locale')).toBe('en')
  })

  it('unwraps double-quoted cookie values', () => {
    expect(parseCookie('locale="en"', 'locale')).toBe('en')
    expect(parseCookie('locale="en-US"', 'locale')).toBe('en-US')
  })

  it('ignores malformed percent-encoded cookie values instead of throwing', () => {
    expect(parseCookie('locale=%E0%A4%A; theme=dark', 'locale')).toBeNull()
  })
})

describe('Accept-Language parsing', () => {
  it('handles NaN/invalid quality parameter cleanly', () => {
    expect(parseAcceptLanguage('ar-EG;q=invalid, en;q=0.8')).toBe('en')
  })
})

describe('cookie serialization', () => {
  it('CookieOptions permits every documented attribute', () => {
    const opts: CookieOptions = {
      path: '/',
      maxAge: 1,
      sameSite: 'Lax',
      secure: true,
      httpOnly: true,
      domain: 'example.com',
    }
    // also accepts a strict subset / disables booleans
    const minimal: CookieOptions = { httpOnly: false }
    expect(serializeCookie('locale', 'ar', opts)).toContain(
      'Domain=example.com',
    )
    expect(serializeCookie('locale', 'ar', minimal)).toBe('locale=ar; Path=/')
  })

  it('uses name, encoded value, and Path=/ by default', () => {
    expect(serializeCookie('locale', 'ar')).toBe('locale=ar; Path=/')
  })

  it('URL-encodes the value', () => {
    expect(serializeCookie('locale', 'en-US')).toBe('locale=en-US; Path=/')
    // values that need encoding survive the round trip
    expect(serializeCookie('locale', 'a;b c')).toBe('locale=a%3Bb%20c; Path=/')
  })

  it('emits Max-Age when provided', () => {
    expect(serializeCookie('locale', 'ar', { maxAge: 3600 })).toBe(
      'locale=ar; Path=/; Max-Age=3600',
    )
  })

  it('emits SameSite when provided', () => {
    expect(serializeCookie('locale', 'ar', { sameSite: 'Strict' })).toBe(
      'locale=ar; Path=/; SameSite=Strict',
    )
  })

  it('emits Secure, HttpOnly, and Domain when truthy', () => {
    expect(
      serializeCookie('locale', 'ar', {
        secure: true,
        httpOnly: true,
        domain: '.example.com',
      }),
    ).toBe('locale=ar; Path=/; Secure; HttpOnly; Domain=.example.com')
  })

  it('omits Secure/HttpOnly when explicitly false', () => {
    expect(
      serializeCookie('locale', 'ar', { secure: false, httpOnly: false }),
    ).toBe('locale=ar; Path=/')
  })

  it('honors a custom path', () => {
    expect(serializeCookie('locale', 'ar', { path: '/app' })).toBe(
      'locale=ar; Path=/app',
    )
  })

  it('emits all attributes together in a stable order', () => {
    expect(
      serializeCookie('locale', 'ar', {
        path: '/app',
        maxAge: 60,
        sameSite: 'Lax',
        secure: true,
        httpOnly: true,
        domain: 'example.com',
      }),
    ).toBe(
      'locale=ar; Path=/app; Max-Age=60; SameSite=Lax; Secure; HttpOnly; Domain=example.com',
    )
  })
})

describe('safeRedirectPath', () => {
  it('blocks dangerous redirect paths and allows safe ones', () => {
    expect(safeRedirectPath('/home')).toBe('/home')
    expect(safeRedirectPath('/about/us?ref=xyz')).toBe('/about/us?ref=xyz')
    expect(safeRedirectPath('//evil.com')).toBe('/')
    expect(safeRedirectPath('/\\evil.com')).toBe('/')
    expect(safeRedirectPath('/\\/evil.com')).toBe('/')
    expect(safeRedirectPath('///evil.com')).toBe('/')
    expect(safeRedirectPath('https://evil.com')).toBe('/')
    expect(safeRedirectPath('//')).toBe('/')
    expect(safeRedirectPath('/%2f/evil.com')).toBe('/%2f/evil.com')
  })

  it('blocks control character bypasses (tab, newline, CR)', () => {
    expect(safeRedirectPath('/\t/evil.com')).toBe('/')
    expect(safeRedirectPath('/\n/evil.com')).toBe('/')
    expect(safeRedirectPath('/\r/evil.com')).toBe('/')
    expect(safeRedirectPath('/\n\r\t/evil.com')).toBe('/')
    expect(safeRedirectPath('/\\\t/evil.com')).toBe('/')
  })
})

describe('appendDataSuffix', () => {
  it('appends .data before query string and hash', () => {
    expect(appendDataSuffix('/en/about?tab=1#top')).toBe(
      '/en/about.data?tab=1#top',
    )
  })
})
