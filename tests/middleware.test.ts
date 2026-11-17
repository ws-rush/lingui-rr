import { setupI18n } from '@lingui/core'
import {
  RouterContextProvider,
  type ClientActionFunctionArgs,
  type ClientLoaderFunctionArgs,
  type DataStrategyResult,
  type MiddlewareFunction,
  type RouterContextProvider as RRContextProvider,
} from 'react-router'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  clientDetectors,
  createLinguiClientMiddleware,
  createLinguiMiddleware,
  createLinguiRootLoader,
  createLinguiRouter,
  createLinguiShouldRevalidate,
  linguiRouterContext,
  serverDetectors,
  type LinguiRootLoaderData,
  type LinguiState,
} from '../src/index'

describe('middleware and loader', () => {
  it('url-prefix middleware redirects unprefixed paths before next', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/about', {
          headers: { 'Accept-Language': 'ar-EG' },
        }),
        url: new URL('https://example.com/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/ar/about')
  })

  it('url-prefix middleware serves hidden default locale without self-redirecting', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/', {
          headers: { 'Accept-Language': 'ar' },
        }),
        url: new URL('https://example.com/'),
        context,
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(true)
    expect((response as Response).status).toBe(200)
    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
  })

  it('url-prefix middleware removes default prefix when default locale is hidden', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/ar/about'),
        url: new URL('https://example.com/ar/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/about')
  })

  it('middleware stores loaded Lingui state and loader returns it', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: {
        en: { label: 'English', dir: 'ltr' },
        ar: { label: 'العربية', dir: 'rtl' },
      },
      defaultLocale: 'en',
      detection: [serverDetectors.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: { hello: 'Hello' } }),
        ar: async () => ({ messages: { hello: 'مرحبا' } }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)
    const loader = createLinguiRootLoader(i18n)

    await middleware(
      {
        request: new Request('https://example.com/current', {
          headers: { Cookie: 'locale=ar' },
        }),
        url: new URL('https://example.com/current'),
        context,
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
    await expect(
      loader({
        request: new Request('https://example.com/current'),
        url: new URL('https://example.com/current'),
        context,
        params: {},
        pattern: '*',
      }),
    ).resolves.toMatchObject({
      locale: 'ar',
      localeMeta: { label: 'العربية', dir: 'rtl' },
      htmlAttrs: { lang: 'ar', dir: 'rtl' },
    })
  })

  it('root loader throws clear error when context is missing', async () => {
    const router = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en'],
      defaultLocale: 'en',
      catalogs: { en: async () => ({ messages: {} }) },
    })
    const loader = createLinguiRootLoader(router)
    const context = new RouterContextProvider()

    await expect(
      loader({
        request: new Request('https://example.com/'),
        url: new URL('https://example.com/'),
        context,
        params: {},
        pattern: '*',
      }),
    ).rejects.toThrow(/Lingui state was not found in React Router context/)
  })

  it('root loader resolves fallback state on ignoredPaths in url-prefix mode when middleware skips context', async () => {
    const router = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: {
        en: { label: 'English', dir: 'ltr' },
        ar: { label: 'العربية', dir: 'rtl' },
      },
      defaultLocale: 'en',
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        en: async () => ({ messages: { hello: 'Hello' } }),
        ar: async () => ({ messages: { hello: 'مرحبا' } }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(router)
    const loader = createLinguiRootLoader(router)
    const request = new Request('https://example.com/api/data', {
      headers: { 'Accept-Language': 'ar' },
    })
    let calledNext = false

    await middleware(
      {
        request,
        url: new URL(request.url),
        context,
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(true)
    expect(context.get(linguiRouterContext)).toBeNull()

    await expect(
      loader({
        request,
        url: new URL(request.url),
        context,
        params: {},
        pattern: '*',
      }),
    ).resolves.toMatchObject({
      locale: 'ar',
      localeMeta: { code: 'ar', label: 'العربية', dir: 'rtl' },
      messages: { hello: 'مرحبا' },
      htmlAttrs: { lang: 'ar', dir: 'rtl' },
    })
  })

  it('root loader throws clear error on non-ignored path in url-prefix mode when context is missing', async () => {
    const router = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const loader = createLinguiRootLoader(router)
    const context = new RouterContextProvider()

    await expect(
      loader({
        request: new Request('https://example.com/about'),
        url: new URL('https://example.com/about'),
        context,
        params: {},
        pattern: '*',
      }),
    ).rejects.toThrow(/Lingui state was not found in React Router context/)
  })

  it('root loader returns only the explicit serializable state boundary', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: {
        en: { label: 'English', dir: 'ltr' },
        ar: { label: 'العربية', dir: 'rtl' },
      },
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const loader = createLinguiRootLoader(i18n)
    const serializableState: LinguiState = {
      locale: 'en',
      localeMeta: { code: 'en', label: 'English', dir: 'ltr' },
      locales: [
        { code: 'en', label: 'English', dir: 'ltr' },
        { code: 'ar', label: 'العربية', dir: 'rtl' },
      ],
      messages: { hello: 'Hello' },
      htmlAttrs: { lang: 'en', dir: 'ltr' },
    }
    const stateWithRuntimeOnlyFields = {
      ...serializableState,
      i18n: setupI18n(),
      runtimeOnly: () => 'not serializable',
    }

    context.set(linguiRouterContext, stateWithRuntimeOnlyFields)

    const loaded = await loader({
      request: new Request('https://example.com/current'),
      url: new URL('https://example.com/current'),
      context,
      params: {},
      pattern: '*',
    })

    expect(loaded).toStrictEqual(serializableState)
    expect(Object.hasOwn(loaded, 'i18n')).toBe(false)
    expect(Object.hasOwn(loaded, 'runtimeOnly')).toBe(false)
    expect(JSON.parse(JSON.stringify(loaded))).toStrictEqual(loaded)
  })

  it('server:false middleware can detect a client cookie during an SSR request', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)

    await middleware(
      {
        request: new Request('https://example.com/current', {
          headers: { Cookie: 'locale=ar' },
        }),
        url: new URL('https://example.com/current'),
        context,
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
  })

  it('server:false url-prefix middleware redirects using client cookie detection during an SSR request', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/about', {
          headers: { Cookie: 'locale=en' },
        }),
        url: new URL('https://example.com/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('server:false url-prefix middleware loads state for a canonical prefixed request', async () => {
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/en/about', {
          headers: { Cookie: 'locale=ar' },
        }),
        url: new URL('https://example.com/en/about'),
        context,
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(200)
    expect(context.get(linguiRouterContext)?.locale).toBe('en')
  })

  it('url-prefix middleware redirects non-canonical casing to the canonical prefix', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/EN/about'),
        url: new URL('https://example.com/EN/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware canonicalizes a supported-base regional prefix (/en-us)', async () => {
    // 'en' is supported; 'en-us' matches by base fallback but is not the
    // canonical prefix, so the middleware redirects to the canonical locale.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/en-us/about'),
        url: new URL('https://example.com/en-us/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware canonicalizes a supported-base regional prefix with casing (/en-GB)', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/en-GB/about'),
        url: new URL('https://example.com/en-GB/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware redirects an unsupported regional prefix to the detected locale prefix', async () => {
    // 'de-DE' is locale-like but neither the region nor its base is supported.
    // The middleware redirects to a supported locale prefix (detected/default)
    // while preserving the rest of the path.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/de-DE/about'),
        url: new URL('https://example.com/de-DE/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware redirects an unsupported regional prefix to a non-default detected locale', async () => {
    // Same as above, but detection picks a non-default locale; the redirected
    // prefix reflects the detected locale, not the unsupported one.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/de-DE/about', {
          headers: { 'Accept-Language': 'ar-EG' },
        }),
        url: new URL('https://example.com/de-DE/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/ar/about')
  })

  it('url-prefix middleware redirects an unsupported base-language prefix to the detected locale', async () => {
    // 'fr' is locale-like but unsupported; redirects to detected/default prefix.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    const response = await middleware(
      {
        request: new Request('https://example.com/fr/about'),
        url: new URL('https://example.com/fr/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => new Response('ok'),
    )

    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/en/about')
  })

  it('url-prefix middleware redirects non-default detection and preserves query/hash', async () => {
    // prefixDefaultLocale: false, default locale ar. An unprefixed path with a
    // cookie selecting the *non-default* locale 'en' must redirect to the
    // prefixed URL while keeping the query string and hash.
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/about?page=3#section', {
          headers: { Cookie: 'locale=en' },
        }),
        url: new URL('https://example.com/about?page=3#section'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe(
      '/en/about?page=3#section',
    )
  })

  it('url-prefix middleware serves the hidden default locale and preserves query/hash', async () => {
    // Same hidden-default setup, but detection selects the default locale 'ar',
    // so the unprefixed URL is served directly (no self-redirect) with query/hash intact.
    const i18n = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['ar', 'en'],
      defaultLocale: 'ar',
      prefixDefaultLocale: false,
      detection: [clientDetectors.cookie('locale')],
      catalogs: {
        ar: async () => ({ messages: {} }),
        en: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/blog?tag=news#top', {
          headers: { Cookie: 'locale=ar' },
        }),
        url: new URL('https://example.com/blog?tag=news#top'),
        context,
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(true)
    expect((response as Response).status).toBe(200)
    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
  })

  it('url-prefix middleware respects a custom ignorePaths list', async () => {
    // The default ignored paths are replaced by config.ignorePaths, so a path
    // that the defaults would ignore is now processed by the middleware.
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      ignorePaths: ['/healthcheck'],
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)
    let calledNext = false

    const apiResponse = await middleware(
      {
        request: new Request('https://example.com/assets/users'),
        url: new URL('https://example.com/assets/users'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    // /assets is no longer in the custom ignorePaths, so the middleware redirects.
    expect(calledNext).toBe(false)
    expect((apiResponse as Response).status).toBe(302)
    expect((apiResponse as Response).headers.get('Location')).toBe(
      '/en/assets/users',
    )

    calledNext = false
    const healthResponse = await middleware(
      {
        request: new Request('https://example.com/healthcheck'),
        url: new URL('https://example.com/healthcheck'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    // The custom ignorePaths entry is honored: middleware calls next directly.
    expect(calledNext).toBe(true)
    expect((healthResponse as Response).status).toBe(200)
  })

  it('propagates a catalog loader failure through the middleware', async () => {
    const i18n = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => {
          throw new Error('boom')
        },
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(i18n)

    await expect(
      middleware(
        {
          request: new Request('https://example.com/en/about'),
          url: new URL('https://example.com/en/about'),
          context: new RouterContextProvider(),
          params: {},
          pattern: '*',
        },
        async () => new Response('ok'),
      ),
    ).rejects.toThrow(/Failed to load catalog for locale "en"/)
  })
})

describe('Single Fetch .data requests in createLinguiMiddleware', () => {
  it('redirects unprefixed .data request in url-prefix mode while preserving query params', async () => {
    const router = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(router)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/about.data?tab=1'),
        url: new URL('https://example.com/about.data?tab=1'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe(
      '/en/about.data?tab=1',
    )
  })

  it('redirects default-prefixed .data request when prefixDefaultLocale is false', async () => {
    const router = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      prefixDefaultLocale: false,
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const middleware = createLinguiMiddleware(router)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/en/about.data'),
        url: new URL('https://example.com/en/about.data'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(false)
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(302)
    expect((response as Response).headers.get('Location')).toBe('/about.data')
  })
})

describe('Non-GET/HEAD requests in createLinguiMiddleware', () => {
  it('does not redirect POST on unprefixed path in url-prefix mode and populates detected locale', async () => {
    const router = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      detection: [serverDetectors.acceptLanguage()],
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(router)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/about', {
          method: 'POST',
          headers: { 'Accept-Language': 'ar-EG' },
        }),
        url: new URL('https://example.com/about'),
        context,
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(true)
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(200)
    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
  })

  it('does not redirect POST on default-prefixed path when prefixDefaultLocale is false', async () => {
    const router = createLinguiRouter({
      server: true,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      prefixDefaultLocale: false,
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const context = new RouterContextProvider()
    const middleware = createLinguiMiddleware(router)
    let calledNext = false

    const response = await middleware(
      {
        request: new Request('https://example.com/en/about', {
          method: 'POST',
        }),
        url: new URL('https://example.com/en/about'),
        context,
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return new Response('ok')
      },
    )

    expect(calledNext).toBe(true)
    expect(response).toBeInstanceOf(Response)
    expect((response as Response).status).toBe(200)
    expect(context.get(linguiRouterContext)?.locale).toBe('en')
  })
})

describe('createLinguiClientMiddleware runtime execution', () => {
  it('populates linguiRouterContext and returns the DataStrategyResult map in context mode', async () => {
    const router = createLinguiRouter({
      server: false,
      mode: 'context',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      detection: [clientDetectors.custom({ detect: () => 'ar' })],
      catalogs: {
        en: async () => ({ messages: { hello: 'Hello' } }),
        ar: async () => ({ messages: { hello: 'مرحبا' } }),
      },
    })
    const context = new RouterContextProvider()
    const clientMiddleware = createLinguiClientMiddleware(router)
    const expectedResult: Record<string, DataStrategyResult> = {
      root: { type: 'data', result: { ok: true } },
    }
    let calledNext = false

    const result = await clientMiddleware(
      {
        request: new Request('https://example.com/about'),
        url: new URL('https://example.com/about'),
        context,
        params: {},
        pattern: '*',
      },
      async () => {
        calledNext = true
        return expectedResult
      },
    )

    expect(calledNext).toBe(true)
    expect(result).toBe(expectedResult)
    expect(context.get(linguiRouterContext)?.locale).toBe('ar')
    expect(context.get(linguiRouterContext)?.messages).toEqual({
      hello: 'مرحبا',
    })
  })

  it('redirects unprefixed GET /about to /en/about and calls next() for canonical /en/about in url-prefix mode', async () => {
    const router = createLinguiRouter({
      server: false,
      mode: 'url-prefix',
      locales: ['en', 'ar'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ messages: {} }),
        ar: async () => ({ messages: {} }),
      },
    })
    const clientMiddleware = createLinguiClientMiddleware(router)

    let unprefixedNextCalled = false
    const redirectResult = await clientMiddleware(
      {
        request: new Request('https://example.com/about'),
        url: new URL('https://example.com/about'),
        context: new RouterContextProvider(),
        params: {},
        pattern: '*',
      },
      async () => {
        unprefixedNextCalled = true
        return {}
      },
    )

    expect(unprefixedNextCalled).toBe(false)
    expect(redirectResult).toBeInstanceOf(Response)
    const redirectResponse = redirectResult as unknown as Response
    expect(redirectResponse.status).toBe(302)
    expect(redirectResponse.headers.get('Location')).toBe('/en/about')

    const canonicalContext = new RouterContextProvider()
    const expectedResult: Record<string, DataStrategyResult> = {
      about: { type: 'data', result: { loaded: true } },
    }
    let canonicalNextCalled = false

    const canonicalResult = await clientMiddleware(
      {
        request: new Request('https://example.com/en/about'),
        url: new URL('https://example.com/en/about'),
        context: canonicalContext,
        params: {},
        pattern: '*',
      },
      async () => {
        canonicalNextCalled = true
        return expectedResult
      },
    )

    expect(canonicalNextCalled).toBe(true)
    expect(canonicalResult).toBe(expectedResult)
    expect(canonicalContext.get(linguiRouterContext)?.locale).toBe('en')
  })
})

// Faithful essence of React Router's `SerializeFrom` (from
// `react-router/dist/.../lib/types/route-data.d.ts`). Reproduced here because
// `SerializeFrom` is not part of the public `react-router` surface. It is the
// exact machinery that decides whether `useLoaderData<typeof loader>()` runs
// the recursive `Serialize` step (which widens Lingui `Messages`) or preserves
// the loader's declared return type verbatim.
type RRSerializable =
  | undefined
  | null
  | boolean
  | string
  | symbol
  | number
  | bigint
  | Date
  | URL
  | RegExp
  | Error
  | Array<RRSerializable>
  | { [key: PropertyKey]: RRSerializable }
  | Map<RRSerializable, RRSerializable>
  | Set<RRSerializable>
  | Promise<RRSerializable>

type RRSerialize<T> = T extends RRSerializable
  ? T
  : T extends (...args: any[]) => unknown
    ? undefined
    : T extends Promise<infer U>
      ? Promise<RRSerialize<U>>
      : T extends Array<infer U>
        ? Array<RRSerialize<U>>
        : T extends Record<any, any>
          ? { [K in keyof T]: RRSerialize<T[K]> }
          : undefined

// `ClientDataFunctionArgs` is internal to react-router, so reconstruct its
// public shape (matches `ClientLoaderFunctionArgs` minus `serverLoader`).
type ClientDataFunctionArgs<Params> = {
  request: Request
  url: URL
  params: Params
  pattern: string
  context: Readonly<RRContextProvider>
}

type RRSerializeFrom<F> = F extends (...args: infer A) => unknown
  ? A extends [
      | ClientLoaderFunctionArgs
      | ClientActionFunctionArgs
      | ClientDataFunctionArgs<unknown>,
    ]
    ? Awaited<ReturnType<F>>
    : RRSerialize<Awaited<ReturnType<F>>>
  : never

describe('loader type inference', () => {
  const i18n = createLinguiRouter({
    server: false,
    mode: 'url-prefix',
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    catalogs: {
      ar: async () => ({ messages: {} }),
      en: async () => ({ messages: {} }),
    },
  })

  it('exposes the loader return type that needs no app-level cast', () => {
    const loader = createLinguiRootLoader(i18n)

    // Regression guard for ROADMAP #1: React Router's SerializeFrom must skip its
    // message-widening serialization step so `useLoaderData<typeof loader>()`
    // resolves to `LinguiRootLoaderData` (a.k.a. `LinguiState`) verbatim. If the
    // loader's parameter type ever loosens so this discriminator falls through to
    // `RRSerialize`, `messages` widens to `{ [x]: string | (string | undefined[])[] }`
    // and apps are forced back to `as LinguiState` casts.
    expectTypeOf<
      RRSerializeFrom<typeof loader>
    >().toEqualTypeOf<LinguiRootLoaderData>()
    expectTypeOf<RRSerializeFrom<typeof loader>>().toEqualTypeOf<LinguiState>()
  })
})

describe('middleware export types', () => {
  type ClientResult = Record<string, DataStrategyResult>
  const i18n = createLinguiRouter({
    server: true,
    mode: 'url-prefix',
    locales: ['en', 'ar'],
    defaultLocale: 'en',
    catalogs: {
      en: async () => ({ messages: {} }),
      ar: async () => ({ messages: {} }),
    },
  })

  it('createLinguiMiddleware matches the server `middleware` slot (Response result)', () => {
    const middleware = createLinguiMiddleware(i18n)
    // Server route slot: MiddlewareFunction<Response>
    expectTypeOf<typeof middleware>().toMatchTypeOf<
      MiddlewareFunction<Response>
    >()
  })

  it('createLinguiClientMiddleware matches the `clientMiddleware` slot (DataStrategyResult map)', () => {
    const clientMiddleware = createLinguiClientMiddleware(i18n)
    // Client route slot: MiddlewareFunction<Record<string, DataStrategyResult>>
    expectTypeOf<typeof clientMiddleware>().toMatchTypeOf<
      MiddlewareFunction<ClientResult>
    >()
  })

  it('the server and client result types are distinct (invariant), so the two exports are needed', () => {
    // MiddlewareFunction is invariant in its result type (it flows through `next`).
    // A server-typed middleware must NOT be assignable to the client slot, which is
    // why the package ships a separate `createLinguiClientMiddleware`.
    const serverMiddleware = createLinguiMiddleware(i18n)
    expectTypeOf<typeof serverMiddleware>().not.toMatchTypeOf<
      MiddlewareFunction<ClientResult>
    >()
  })

  it('createLinguiClientMiddleware is not assignable to the server slot either', () => {
    const clientMiddleware = createLinguiClientMiddleware(i18n)
    expectTypeOf<typeof clientMiddleware>().not.toMatchTypeOf<
      MiddlewareFunction<Response>
    >()
  })
})

describe('createLinguiShouldRevalidate', () => {
  const i18n = createLinguiRouter({
    server: false,
    mode: 'url-prefix',
    locales: ['ar', 'en'],
    defaultLocale: 'ar',
    prefixDefaultLocale: false,
    catalogs: {
      ar: async () => ({ messages: {} }),
      en: async () => ({ messages: {} }),
    },
  })

  const shouldRevalidate = createLinguiShouldRevalidate(i18n)
  const baseArgs = {
    currentParams: {},
    nextParams: {},
    defaultShouldRevalidate: false,
  } as const

  it('revalidates when a locale-change action is submitted', () => {
    const currentUrl = new URL('https://example.com/ar/about')
    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl,
        nextUrl: new URL('https://example.com/en/about'),
        formAction: '/change-locale',
        formMethod: 'POST',
      }),
    ).toBe(true)
  })

  it('defers to React Router defaults for pathname-changing navigation', () => {
    expect(
      shouldRevalidate({
        ...baseArgs,
        defaultShouldRevalidate: true,
        currentUrl: new URL('https://example.com/ar/about'),
        nextUrl: new URL('https://example.com/ar/contact'),
      }),
    ).toBe(true)
  })

  it('honors call-site revalidation opt-out for pathname-changing navigation', () => {
    expect(
      shouldRevalidate({
        ...baseArgs,
        defaultShouldRevalidate: false,
        currentUrl: new URL('https://example.com/ar/about'),
        nextUrl: new URL('https://example.com/ar/contact'),
      }),
    ).toBe(false)
  })

  it('matches the action path even when the submission posts to the full URL', () => {
    const currentUrl = new URL('https://example.com/ar/about')
    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl,
        nextUrl: currentUrl, // context mode: redirect lands on the same path
        formAction: 'https://example.com/change-locale',
        formMethod: 'POST',
      }),
    ).toBe(true)
  })

  it('defers to React Router defaults for search-param-only navigation', () => {
    const currentUrl = new URL('https://example.com/ar/blog?page=1')
    const nextUrl = new URL('https://example.com/ar/blog?page=2')

    expect(
      shouldRevalidate({
        ...baseArgs,
        defaultShouldRevalidate: false,
        currentUrl,
        nextUrl,
      }),
    ).toBe(false)

    expect(
      shouldRevalidate({
        ...baseArgs,
        defaultShouldRevalidate: true,
        currentUrl,
        nextUrl,
      }),
    ).toBe(true)
  })

  it('defers to React Router defaults for unrelated form actions', () => {
    const currentUrl = new URL('https://example.com/ar/contact')

    expect(
      shouldRevalidate({
        ...baseArgs,
        defaultShouldRevalidate: false,
        currentUrl,
        nextUrl: currentUrl,
        formAction: '/contact',
        formMethod: 'POST',
      }),
    ).toBe(false)

    expect(
      shouldRevalidate({
        ...baseArgs,
        defaultShouldRevalidate: true,
        currentUrl,
        nextUrl: currentUrl,
        formAction: '/contact',
        formMethod: 'POST',
      }),
    ).toBe(true)
  })

  it('revalidates when the formAction is prefixed with a supported locale', () => {
    const currentUrl = new URL('https://example.com/ar/about')
    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl,
        nextUrl: currentUrl,
        formAction: '/ar/change-locale',
        formMethod: 'POST',
      }),
    ).toBe(true)
  })

  it('revalidates when formAction ends with .data even if defaultShouldRevalidate is false', () => {
    const currentUrl = new URL('https://example.com/en/about')

    expect(
      shouldRevalidate({
        ...baseArgs,
        currentUrl,
        nextUrl: currentUrl,
        formAction: '/en/change-locale.data',
        formMethod: 'POST',
      }),
    ).toBe(true)
  })

  it('honors a custom action path', () => {
    const shouldRevalidateCustom = createLinguiShouldRevalidate(i18n, {
      actionPath: '/i18n/switch',
    })
    const currentUrl = new URL('https://example.com/ar/about')
    expect(
      shouldRevalidateCustom({
        ...baseArgs,
        currentUrl,
        nextUrl: currentUrl,
        formAction: '/i18n/switch',
        formMethod: 'POST',
      }),
    ).toBe(true)
    expect(
      shouldRevalidateCustom({
        ...baseArgs,
        currentUrl,
        nextUrl: currentUrl,
        formAction: '/change-locale',
        formMethod: 'POST',
      }),
    ).toBe(false)
  })
})
