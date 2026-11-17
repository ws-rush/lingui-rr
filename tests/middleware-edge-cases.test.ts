import { RouterContextProvider, type DataStrategyResult } from 'react-router'
import { describe, expect, it } from 'vitest'
import {
  clientDetectors,
  createLinguiClientMiddleware,
  createLinguiMiddleware,
  createLinguiRouter,
  createLinguiShouldRevalidate,
  linguiRouterContext,
  serverDetectors,
} from '../src/index'
import { appendDataSuffix } from '../src/utils'

describe('Middleware edge cases', () => {
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

    it('appendDataSuffix appends .data before query string and hash', () => {
      expect(appendDataSuffix('/en/about?tab=1#top')).toBe(
        '/en/about.data?tab=1#top',
      )
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

  describe('createLinguiShouldRevalidate with .data formAction', () => {
    it('revalidates when formAction ends with .data even if defaultShouldRevalidate is false', () => {
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
      const shouldRevalidate = createLinguiShouldRevalidate(router)
      const currentUrl = new URL('https://example.com/en/about')

      expect(
        shouldRevalidate({
          currentUrl,
          nextUrl: currentUrl,
          currentParams: {},
          nextParams: {},
          defaultShouldRevalidate: false,
          formAction: '/en/change-locale.data',
          formMethod: 'POST',
        }),
      ).toBe(true)
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
})
