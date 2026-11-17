import { type SessionStorage } from 'react-router'
import { describe, expect, it } from 'vitest'
import {
  clientPersistence,
  createLinguiRouter,
  createLocaleAction,
  getLocaleLabel,
  loadLinguiState,
  serverPersistence,
} from '../src/index'

describe('catalog shapes and loading', () => {
  it('loads the Lingui .po import shape { messages: { id: string } }', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: { hello: 'Hello', bye: 'Goodbye' } }),
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({ hello: 'Hello', bye: 'Goodbye' })
    expect(state.locale).toBe('en')
  })

  it('loads the compiled .js catalog shape { messages: { hash: CompiledMessage[] } }', async () => {
    // lingui compile emits { messages: { hash: CompiledMessageToken[] } } where
    // CompiledMessageToken is string | [name, type?, format?]. String values are
    // the common (non-ICU) case, represented as a single-token array ["..."] or
    // as a plain string per UncompiledMessage.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({
          messages: { greeting: ['Hello'], withArg: ['Hello, ', ['0'], '!'] },
        }),
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect((state.messages as Record<string, unknown>).greeting).toEqual([
      'Hello',
    ])
  })

  it('loads a bare messages record (no messages wrapper)', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ hello: 'Hello' }),
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({ hello: 'Hello' })
  })

  it('loads a bare messages record containing a key named "messages"', async () => {
    const router = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: 'Message value', hello: 'Hello' }),
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(router, 'en')
    expect(state.messages).toEqual({
      messages: 'Message value',
      hello: 'Hello',
    })
  })

  it('loads a catalog wrapped in an ES module default export (nested messages)', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () =>
          ({ default: { messages: { hello: 'Hello ES' } } }) as any,
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({ hello: 'Hello ES' })
  })

  it('loads a catalog wrapped in an ES module default export (bare messages)', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ default: { hello: 'Hello ES Bare' } }) as any,
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({ hello: 'Hello ES Bare' })
  })

  it('accepts an empty messages catalog', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })

    const state = await loadLinguiState(i18n, 'en')
    expect(state.messages).toEqual({})
  })

  it('throws when a catalog loader rejects while loading state directly', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => {
          throw new Error('catalog network down')
        },
        ar: async () => ({ messages: {} }),
      },
    })

    // The loader error is wrapped with locale context; the original error is
    // preserved on `cause`.
    await expect(loadLinguiState(i18n, 'en')).rejects.toThrow(
      /Failed to load catalog for locale "en"/,
    )
    await expect(loadLinguiState(i18n, 'en')).rejects.toMatchObject({
      cause: { message: 'catalog network down' },
    })
  })

  it('throws a clear error when a catalog module has a null messages export', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: null }) as never, // wrong shape
        ar: async () => ({ messages: {} }),
      },
    })

    await expect(loadLinguiState(i18n, 'en')).rejects.toThrow(
      /Catalog for locale "en" did not contain usable messages/,
    )
  })

  it('throws a clear error when a catalog module resolves to null', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => null as never,
        ar: async () => ({ messages: {} }),
      },
    })

    await expect(loadLinguiState(i18n, 'en')).rejects.toThrow(
      /Catalog for locale "en" resolved to null/,
    )
  })
})

describe('locale metadata helpers', () => {
  it('defaults to normalized code if locales list is omitted', () => {
    expect(getLocaleLabel('ar')).toBe('ar')
  })

  it('returns label when input is a LocaleMeta object', () => {
    expect(getLocaleLabel({ code: 'ar', label: 'العربية', dir: 'rtl' })).toBe(
      'العربية',
    )
  })
})

describe('createLocaleAction', () => {
  it('persists server cookie and redirects with rewritten URL prefix', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/en/about' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/ar/about')
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
  })

  it('server action persists cookie and redirects unchanged in context mode', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({
        locale: 'ar',
        redirectTo: '/terms-and-conditions',
      }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/terms-and-conditions')
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
  })

  it('client action uses client persistence and redirects unchanged in context mode', async () => {
    const writes: string[] = []
    const i18n = createLinguiRouter({
      server: false,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [
        clientPersistence.custom({
          write: async (_ctx, locale) => {
            writes.push(locale)
          },
        }),
      ],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(writes).toEqual(['ar'])
    expect(response.headers.get('Location')).toBe('/current')
  })

  it('server:false client cookie persistence returns Set-Cookie during an SSR action', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [clientPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/current')
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
  })

  it('server:false url-prefix action persists client cookie and rewrites redirect path during SSR', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      persistence: [clientPersistence.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'en', redirectTo: '/about' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/en/about')
    expect(response.headers.get('Set-Cookie')).toContain('locale=en')
  })

  it('accepts an application/json payload', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'ar', redirectTo: '/en/about' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/ar/about')
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
  })

  it('returns 400 when application/json body is invalid JSON', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad',
    })

    const response = await action({ request })

    expect(response.status).toBe(400)
    expect(await response.text()).toBe('Invalid JSON payload')
  })

  it('returns 400 when application/json body is null or non-object JSON', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)

    for (const body of ['null', '"string"', '123', '[]']) {
      const request = new Request('https://example.com/change-locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })

      const response = await action({ request })

      expect(response.status).toBe(400)
      expect(await response.text()).toBe('Invalid JSON payload')
    }
  })

  it('defaults the redirect target to "/" when the json payload omits redirectTo', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'ar' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/')
  })

  it('falls back to the fallback locale for an unsupported locale in the payload', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      fallbackLocale: 'ar',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'fr', redirectTo: '/current' }),
    })

    const response = await action({ request })

    // 'fr' is unsupported → matchSupportedLocale falls back to fallbackLocale 'ar'.
    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
    expect(response.headers.get('Location')).toBe('/current')
  })

  it('ignores a missing locale and persists the fallback locale', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      fallbackLocale: 'ar',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.headers.get('Set-Cookie')).toContain('locale=ar')
    expect(response.headers.get('Location')).toBe('/current')
  })

  it.each([
    ['protocol-relative', '//evil.com'],
    ['absolute https', 'https://evil.com/path'],
    ['absolute http', 'http://evil.com'],
    ['backslash protocol-relative', '\\\\evil.com'],
    ['scheme separator', '/\\evil.com'],
    ['tab control char', '/\t/evil.com'],
    ['newline control char', '/\n/evil.com'],
    ['CR control char', '/\r/evil.com'],
    ['backslash-slash', '/\\/evil.com'],
    ['triple-slash', '///evil.com'],
  ])('neutralizes an open-redirect payload (%s)', async (_name, payload) => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: payload }),
    })

    const response = await action({ request })

    expect(response.headers.get('Location')).toBe('/')
  })

  it('allows a relative redirect with query/hash and rewrites the prefix in url-prefix mode', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [serverPersistence.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/about?x=1#t' }),
    })

    const response = await action({ request })

    expect(response.headers.get('Location')).toBe('/ar/about?x=1#t')
  })

  it('merges Set-Cookie headers from multiple persistence adapters', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [
        serverPersistence.cookie('locale', { httpOnly: true }),
        serverPersistence.cookie('prefs', { httpOnly: false }),
      ],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    // Both cookies survive the merge as separate Set-Cookie values
    // (Headers.append preserves them; .get() comma-joins them).
    expect(response.headers.get('Location')).toBe('/current')
    expect(response.headers.getSetCookie()).toEqual([
      'locale=ar; Path=/; SameSite=Lax; HttpOnly',
      'prefs=ar; Path=/; SameSite=Lax',
    ])
  })

  it('merges Set-Cookie headers when one adapter is session-backed', async () => {
    const sessionJar = { cookie: '' }
    const sessionStorage: Pick<SessionStorage, 'getSession' | 'commitSession'> =
      {
        getSession: async () =>
          ({
            get: () => undefined,
            set: () => {},
            has: () => false,
            unset: () => {},
            flash: () => {},
            id: '',
            data: {},
          }) as never,
        commitSession: async () => {
          const v = 'session=%7B%22locale%22%3A%22ar%22%7D'
          sessionJar.cookie = v
          return v
        },
      }
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [
        serverPersistence.cookie('locale', { httpOnly: true }),
        serverPersistence.session(sessionStorage),
      ],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.headers.getSetCookie()).toEqual([
      'locale=ar; Path=/; SameSite=Lax; HttpOnly',
      'session=%7B%22locale%22%3A%22ar%22%7D',
    ])
  })

  it('preserves multiple Set-Cookie values from a single adapter returning [name, value][]', async () => {
    // A custom adapter can return multiple Set-Cookie values by using the
    // array-of-tuples HeadersInit shape, which appendHeaders preserves.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [
        serverPersistence.custom({
          read: async () => null,
          write: async () => [
            ['Set-Cookie', 'a=1; Path=/'],
            ['Set-Cookie', 'b=2; Path=/'],
          ],
        }),
      ],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.headers.getSetCookie()).toEqual([
      'a=1; Path=/',
      'b=2; Path=/',
    ])
  })

  it('merges headers across adapters with different header names', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      persistence: [
        serverPersistence.cookie('locale'),
        serverPersistence.custom({
          read: async () => null,
          write: async () => ({ 'X-Locale': 'ar', Vary: 'Cookie' }),
        }),
      ],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.headers.get('X-Locale')).toBe('ar')
    expect(response.headers.get('Vary')).toBe('Cookie')
    expect(response.headers.get('Location')).toBe('/current')
  })

  it('still works when persistence is empty', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const action = createLocaleAction(i18n)
    const request = new Request('https://example.com/change-locale', {
      method: 'POST',
      body: new URLSearchParams({ locale: 'ar', redirectTo: '/current' }),
    })

    const response = await action({ request })

    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/current')
    expect(response.headers.getSetCookie()).toEqual([])
  })
})
