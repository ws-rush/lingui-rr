import { describe, expect, it } from 'vitest'
import {
  createLinguiRouter,
  createLocaleAction,
  loadLinguiState,
  matchSupportedLocale,
  normalizeLocaleCode,
  type LinguiRouterConfig,
} from '../src/index'

describe('bugfixes regressions', () => {
  describe('underscore locale codes', () => {
    it('normalizes underscore-separated locale tags', () => {
      expect(normalizeLocaleCode('en_us')).toBe('en-US')
      expect(normalizeLocaleCode('en_US')).toBe('en-US')
      expect(normalizeLocaleCode('zh_hant_tw')).toBe('zh-Hant-TW')
    })

    it('matches underscore-separated locale tags against supported locales', () => {
      expect(matchSupportedLocale('ar_eg', ['en', 'ar'], 'en')).toBe('ar')
      expect(matchSupportedLocale('en_US', ['en-US', 'ar'], 'ar')).toBe('en-US')
    })
  })

  describe('catalog key normalization', () => {
    it('normalizes config.catalogs keys without mutating the input config', async () => {
      const config: LinguiRouterConfig = {
        server: true,
        mode: 'context',
        locales: ['en-us'],
        defaultLocale: 'en-us',
        catalogs: {
          'en-us': async () => ({ messages: { hi: 'Hi' } }),
        },
      }

      const router = createLinguiRouter(config)

      expect(Object.keys(config.catalogs)).toEqual(['en-us'])
      expect(Object.keys(router.config.catalogs)).toEqual(['en-US'])

      const state = await loadLinguiState(router, 'en-US')
      expect(state.locale).toBe('en-US')
      expect(state.messages).toEqual({ hi: 'Hi' })
    })
  })

  describe('malformed JSON action payloads', () => {
    function createAction() {
      const router = createLinguiRouter({
        server: true,
        mode: 'context',
        locales: ['en', 'ar'],
        defaultLocale: 'en',
        catalogs: {
          en: async () => ({ messages: {} }),
          ar: async () => ({ messages: {} }),
        },
      })
      return createLocaleAction(router)
    }

    it('returns 400 when application/json body is invalid JSON', async () => {
      const action = createAction()
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
      const action = createAction()

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
  })
})
