import { describe, expect, it } from 'vitest'
import { rewriteLocalePath } from '../src/index'
import { isIgnoredPath, looksLikeLocale } from '../src/path'

describe('URL prefix rewrite', () => {
  it('strictly prefixes unprefixed app paths', () => {
    expect(rewriteLocalePath('/about?x=1', 'ar', ['en', 'ar'])).toBe(
      '/ar/about?x=1',
    )
  })

  it('replaces existing locale prefix', () => {
    expect(rewriteLocalePath('/en/about', 'ar', ['en', 'ar'])).toBe('/ar/about')
  })

  it('redirects unsupported locale-looking prefix to target locale', () => {
    expect(rewriteLocalePath('/fr/about', 'en', ['en', 'ar'])).toBe('/en/about')
  })

  it('removes default prefix when prefixDefaultLocale is false', () => {
    expect(
      rewriteLocalePath('/ar/about', 'en', ['en', 'ar'], {
        defaultLocale: 'en',
        prefixDefaultLocale: false,
      }),
    ).toBe('/about')
  })

  it('does not rewrite ignored paths', () => {
    expect(rewriteLocalePath('/api/users', 'ar', ['en', 'ar'])).toBe(
      '/api/users',
    )
  })

  it('preserves query string and hash when prefixing a path', () => {
    expect(
      rewriteLocalePath('/about?a=1&b=2#section', 'ar', ['en', 'ar']),
    ).toBe('/ar/about?a=1&b=2#section')
  })

  it('preserves query string and hash when removing the default prefix', () => {
    expect(
      rewriteLocalePath('/en/about?page=2#top', 'en', ['en', 'ar'], {
        defaultLocale: 'en',
        prefixDefaultLocale: false,
      }),
    ).toBe('/about?page=2#top')
  })

  it('preserves query string and hash when switching an existing prefix', () => {
    expect(rewriteLocalePath('/en/about?q=hi#frag', 'ar', ['en', 'ar'])).toBe(
      '/ar/about?q=hi#frag',
    )
  })

  it('canonicalizes a non-canonical locale prefix to the supported casing', () => {
    // The first segment is matched case-insensitively against supported locales;
    // when 'en' is supported, '/en-us/...' is rewritten onto the canonical 'en'.
    expect(rewriteLocalePath('/en-us/about', 'en', ['en', 'ar'])).toBe(
      '/en/about',
    )
  })

  it('keeps an unsupported locale-looking segment that is not locale-like', () => {
    // 'about' is not locale-like, so it is treated as a real path segment.
    expect(rewriteLocalePath('/about', 'ar', ['en', 'ar'])).toBe('/ar/about')
  })

  it('keeps an unsupported locale-like segment if it is a normal path segment (e.g. app)', () => {
    expect(rewriteLocalePath('/app/dashboard', 'ar', ['en', 'ar'])).toBe(
      '/ar/app/dashboard',
    )
  })

  it('respects a custom ignorePaths list that replaces the defaults', () => {
    // With a fully custom ignorePaths, the default /assets is no longer ignored...
    expect(
      rewriteLocalePath('/assets/main.css', 'ar', ['en', 'ar'], {
        ignorePaths: ['/healthcheck'],
      }),
    ).toBe('/ar/assets/main.css')
    // ...but the custom entry is.
    expect(
      rewriteLocalePath('/healthcheck', 'ar', ['en', 'ar'], {
        ignorePaths: ['/healthcheck'],
      }),
    ).toBe('/healthcheck')
  })

  it('treats global RegExp ignorePaths deterministically across repeated calls', () => {
    const ignorePaths = [/^\/api\//g]

    expect(
      rewriteLocalePath('/api/users', 'ar', ['en', 'ar'], { ignorePaths }),
    ).toBe('/api/users')
    expect(
      rewriteLocalePath('/api/users', 'ar', ['en', 'ar'], { ignorePaths }),
    ).toBe('/api/users')
  })

  it('falls back to options.defaultLocale when targetLocale is unsupported', () => {
    expect(
      rewriteLocalePath('/about', 'xx', ['en', 'ar'], { defaultLocale: 'ar' }),
    ).toBe('/ar/about')
  })
})

describe('isIgnoredPath and looksLikeLocale boundaries', () => {
  it('matches string ignorePaths by prefix only', () => {
    expect(isIgnoredPath('/api/users', ['/api'])).toBe(true)
    expect(isIgnoredPath('/v1/api', ['/api'])).toBe(false)
  })

  it('validates ISO-639-1, excluded codes, hyphenated subtags, and anchors in looksLikeLocale', () => {
    expect(looksLikeLocale('fr')).toBe(true)
    expect(looksLikeLocale('he')).toBe(false)
    expect(looksLikeLocale('xx')).toBe(false)
    expect(looksLikeLocale('zz-top')).toBe(true)
    expect(looksLikeLocale('12-en')).toBe(false)
    expect(looksLikeLocale('en-123456789')).toBe(false)
  })
})
