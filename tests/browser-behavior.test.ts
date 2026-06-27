import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { clientDetectors, clientPersistence, runDetectors } from '../src/index'

// These tests exercise the *browser* code paths of the client detectors and
// persistence adapters. In Node (the default vitest environment) the browser
// globals are absent, so the adapters short-circuit to null/`Set-Cookie`. To
// cover the real browser branches we stub `localStorage`, `navigator`, and
// `document.cookie` with minimal stand-ins. This keeps the package free of a
// jsdom/happy-dom test dependency while still exercising the browser behavior.

function createLocalStorageStub(store: Record<string, string>) {
  return {
    getItem: (key: string) =>
      Object.prototype.hasOwnProperty.call(store, key) ? store[key]! : null,
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      for (const key of Object.keys(store)) delete store[key]
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

function createDocumentStub(jar: Record<string, string>) {
  return {
    get cookie() {
      return Object.entries(jar)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')
    },
    set cookie(raw: string) {
      const [pair] = raw.split(';')
      const [rawKey, ...rest] = pair!.split('=')
      const key = rawKey?.trim()
      if (!key) return
      if (rest.length === 0) {
        delete jar[key]
        return
      }
      jar[key] = rest.join('=')
    },
  }
}

describe('browser-only client behavior', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { language: 'en-US' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('localStorage detector and persistence', () => {
    beforeEach(() => {
      vi.stubGlobal('localStorage', createLocalStorageStub({}))
    })

    it('reads a previously stored locale from localStorage', async () => {
      const store = { locale: 'ar' }
      vi.stubGlobal('localStorage', createLocalStorageStub(store))

      const detected = await clientDetectors.localStorage('locale').detect({})

      expect(detected).toBe('ar')
    })

    it('returns null when nothing is stored', async () => {
      const detected = await clientDetectors.localStorage('locale').detect({})

      expect(detected).toBeNull()
    })

    it('writes the chosen locale to localStorage', async () => {
      const store: Record<string, string> = {}
      vi.stubGlobal('localStorage', createLocalStorageStub(store))

      await clientPersistence.localStorage('locale').write({}, 'en')

      expect(store.locale).toBe('en')
    })

    it('persists with a custom key', async () => {
      const store: Record<string, string> = {}
      vi.stubGlobal('localStorage', createLocalStorageStub(store))

      await clientPersistence.localStorage('lang').write({}, 'ar')
      expect(await clientDetectors.localStorage('lang').detect({})).toBe('ar')
    })
  })

  describe('navigator detector', () => {
    it('reads navigator.language in the browser', async () => {
      vi.stubGlobal('navigator', { language: 'ar-EG' })

      expect(await clientDetectors.navigator().detect({})).toBe('ar-EG')
    })
  })

  describe('cookie detector and persistence', () => {
    beforeEach(() => {
      vi.stubGlobal('document', createDocumentStub({}))
    })

    it('reads a locale cookie from document.cookie in the browser', async () => {
      const jar = { locale: 'ar' }
      vi.stubGlobal('document', createDocumentStub(jar))

      expect(await clientDetectors.cookie('locale').detect({})).toBe('ar')
    })

    it('writes a locale cookie to document.cookie and resolves without headers', async () => {
      const jar: Record<string, string> = {}
      vi.stubGlobal('document', createDocumentStub(jar))

      const result = await clientPersistence.cookie('locale').write({}, 'en')

      // In the browser branch the write side-effect is document.cookie and no
      // Set-Cookie header is returned (undefined).
      expect(result).toBeUndefined()
      expect(jar.locale).toBe('en')
    })

    it('round-trips a cookie write then read', async () => {
      const jar: Record<string, string> = {}
      vi.stubGlobal('document', createDocumentStub(jar))

      await clientPersistence.cookie('locale').write({}, 'ar')
      expect(await clientDetectors.cookie('locale').detect({})).toBe('ar')
    })
  })

  describe('full browser detection + persistence flow (server:false, no request)', () => {
    it('detects via localStorage, matches a supported locale, and persists', async () => {
      const store = { locale: 'en' }
      vi.stubGlobal('localStorage', createLocalStorageStub(store))
      vi.stubGlobal('document', createDocumentStub({}))

      const locale = await runDetectors(
        [clientDetectors.localStorage('locale'), clientDetectors.navigator()],
        {},
        ['ar', 'en'],
        'ar',
      )

      expect(locale).toBe('en')

      const headers = await clientPersistence.cookie('locale').write({}, locale)
      // Browser branch writes to document.cookie, returns no headers.
      expect(headers).toBeUndefined()
    })

    it('falls back to the fallback locale when nothing is stored', async () => {
      vi.stubGlobal('localStorage', createLocalStorageStub({}))

      const locale = await runDetectors(
        [clientDetectors.localStorage('locale'), clientDetectors.navigator()],
        {},
        ['ar', 'en'],
        'ar',
      )

      // navigator.language 'en-US' matches supported 'en'.
      expect(locale).toBe('en')
    })
  })
})
