import { describe, expect, it, vi } from 'vitest'
import { clientDetectors, runDetectors, serverDetectors } from '../src/index'

describe('detectors', () => {
  it('runs detectors by priority', async () => {
    const locale = await runDetectors(
      [
        { kind: 'server', detect: async () => null },
        { kind: 'server', detect: async () => 'ar' },
      ],
      { request: new Request('https://example.com') },
      ['en', 'ar'],
      'en',
    )

    expect(locale).toBe('ar')
  })

  it('continues to later detectors when an earlier detector returns an unsupported locale', async () => {
    const locale = await runDetectors(
      [
        { kind: 'server', detect: async () => 'fr' },
        { kind: 'server', detect: async () => 'ar' },
      ],
      { request: new Request('https://example.com') },
      ['en', 'ar'],
      'en',
    )

    expect(locale).toBe('ar')
  })

  it('detects Accept-Language with base fallback', async () => {
    const request = new Request('https://example.com', {
      headers: { 'Accept-Language': 'ar-EG, en;q=0.8' },
    })

    const locale = await serverDetectors.acceptLanguage().detect({ request })
    expect(locale).toBe('ar-EG')
  })

  it('uses default cookie name and custom server detector with kind "server"', async () => {
    const request = new Request('https://example.com', {
      headers: { Cookie: 'locale=ar' },
    })
    const cookieDetector = serverDetectors.cookie()
    expect(cookieDetector.kind).toBe('server')
    expect(await cookieDetector.detect({ request })).toBe('ar')

    const custom = serverDetectors.custom({ detect: () => 'en' })
    expect(custom.kind).toBe('server')
    expect(await custom.detect({ request })).toBe('en')
  })

  it('handles clientDetectors defaults and missing browser globals safely', async () => {
    const request = new Request('https://example.com', {
      headers: { Cookie: 'locale=ar' },
    })
    const cookieDetector = clientDetectors.cookie()
    expect(cookieDetector.kind).toBe('client')
    expect(await cookieDetector.detect({ request })).toBe('ar')
    expect(await cookieDetector.detect({})).toBeNull()

    const lsDetector = clientDetectors.localStorage()
    expect(lsDetector.kind).toBe('client')
    expect(await lsDetector.detect({})).toBeNull()

    const navDetector = clientDetectors.navigator()
    expect(navDetector.kind).toBe('client')
    vi.stubGlobal('navigator', undefined)
    try {
      expect(await navDetector.detect({})).toBeNull()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
