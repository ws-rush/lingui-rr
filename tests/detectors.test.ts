import { describe, expect, it } from 'vitest'
import { runDetectors, serverDetectors } from '../src/index'

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
})
