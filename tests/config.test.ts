import { describe, expect, it } from 'vitest'
import {
  clientDetectors,
  clientPersistence,
  createLinguiRouter,
  loadLinguiState,
  serverDetectors,
  serverPersistence,
  validateConfig,
  type LinguiRouterConfig,
} from '../src/index'

describe('config validation', () => {
  it('throws when config.locales is empty', () => {
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: [],
        defaultLocale: 'en',
        catalogs: {},
      }),
    ).toThrow(/config\.locales: cannot be empty/)
  })

  it('throws when duplicate locale codes exist', () => {
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en', 'EN'],
        defaultLocale: 'en',
        catalogs: {
          en: async () => ({ messages: {} }),
          EN: async () => ({ messages: {} }),
        },
      }),
    ).toThrow(/duplicate locale codes/)
  })

  it('throws when default locale is unsupported', () => {
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['ar'],
        defaultLocale: 'en',
        catalogs: { ar: async () => ({ messages: {} }) },
      }),
    ).toThrow(/defaultLocale/)
  })

  it('throws when catalog loader is missing', () => {
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en', 'ar'],
        defaultLocale: 'en',
        catalogs: { en: async () => ({ messages: {} }) },
      }),
    ).toThrow(/catalog/i)
  })

  it('throws when client detector is used in server config', () => {
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en'],
        defaultLocale: 'en',
        detection: [clientDetectors.localStorage('locale')],
        catalogs: { en: async () => ({ messages: {} }) },
      } as unknown as LinguiRouterConfig),
    ).toThrow(/server: true/)
  })

  it('throws when server config uses client persistence', () => {
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en'],
        defaultLocale: 'en',
        persistence: [clientPersistence.localStorage()],
        catalogs: { en: async () => ({ messages: {} }) },
      } as unknown as LinguiRouterConfig),
    ).toThrow(
      /config\.persistence: server: true configs can only use server persistence/,
    )
  })

  it('throws when client config uses server persistence', () => {
    expect(() =>
      validateConfig({
        server: false,
        mode: 'context',
        locales: ['en'],
        defaultLocale: 'en',
        persistence: [serverPersistence.cookie()],
        catalogs: { en: async () => ({ messages: {} }) },
      } as unknown as LinguiRouterConfig),
    ).toThrow(
      /config\.persistence: server: false configs can only use client persistence/,
    )
  })

  it('error messages name the field, the offending value, and available options', () => {
    // defaultLocale
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['ar'],
        defaultLocale: 'xyz',
        catalogs: { ar: async () => ({ messages: {} }) },
      }),
    ).toThrow(/config\.defaultLocale.*"xyz".*\[ar\]/)

    // fallbackLocale
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en', 'ar'],
        defaultLocale: 'en',
        fallbackLocale: 'xyz',
        catalogs: {
          en: async () => ({ messages: {} }),
          ar: async () => ({ messages: {} }),
        },
      }),
    ).toThrow(/config\.fallbackLocale.*"xyz".*\[en, ar\]/)

    // catalog missing
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en', 'ar'],
        defaultLocale: 'en',
        catalogs: { en: async () => ({ messages: {} }) },
      }),
    ).toThrow(/config\.catalogs.*locale "ar"/)

    // detector kind mismatch names the kind and suggests the right factory
    expect(() =>
      validateConfig({
        server: false,
        mode: 'context',
        locales: ['en'],
        defaultLocale: 'en',
        detection: [serverDetectors.acceptLanguage()],
        catalogs: { en: async () => ({ messages: {} }) },
      } as unknown as LinguiRouterConfig),
    ).toThrow(/config\.detection.*server: false.*client.*clientDetectors/i)

    // prefixDefaultLocale in the wrong mode names the mode
    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en'],
        defaultLocale: 'en',
        prefixDefaultLocale: false,
        catalogs: { en: async () => ({ messages: {} }) },
      }),
    ).toThrow(/config\.prefixDefaultLocale.*"context"/)
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

  it('defaults omitted label and dir in object-form locales and lists multiple duplicates', () => {
    const router = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: { en: {} },
      defaultLocale: 'en',
      catalogs: { en: async () => ({ messages: {} }) },
    })
    expect(router.locales).toEqual([{ code: 'en', label: 'en', dir: 'ltr' }])

    expect(() =>
      validateConfig({
        server: true,
        mode: 'context',
        locales: ['en', 'EN', 'ar', 'AR'],
        defaultLocale: 'en',
        catalogs: {
          en: async () => ({ messages: {} }),
          ar: async () => ({ messages: {} }),
        },
      }),
    ).toThrow(/duplicate locale codes: en, ar/)
  })
})
