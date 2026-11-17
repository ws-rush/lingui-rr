import { type CookieSerializeOptions, type SessionStorage } from 'react-router'
import { describe, expect, it } from 'vitest'
import { clientPersistence, serverPersistence } from '../src/index'

describe('cookie persistence', () => {
  it('serverPersistence.cookie applies SameSite=Lax; HttpOnly defaults', async () => {
    const persistence = serverPersistence.cookie('locale')
    const headers = await persistence.write(
      { request: new Request('https://example.com') },
      'ar',
    )
    expect(headers).toEqual({
      'Set-Cookie': 'locale=ar; Path=/; SameSite=Lax; HttpOnly',
    })
  })

  it('serverPersistence.cookie lets options override the defaults', async () => {
    const persistence = serverPersistence.cookie('locale', {
      sameSite: 'Strict',
      httpOnly: false,
      secure: true,
      maxAge: 120,
      domain: '.example.com',
      path: '/app',
    })
    const headers = await persistence.write(
      { request: new Request('https://example.com') },
      'ar',
    )
    // httpOnly: false disables the default; the rest are applied.
    expect(headers).toEqual({
      'Set-Cookie':
        'locale=ar; Path=/app; Max-Age=120; SameSite=Strict; Secure; Domain=.example.com',
    })
  })

  it('clientPersistence.cookie applies SameSite=Lax default (no httpOnly) during an SSR action', async () => {
    // No document global → server-side action branch returns Set-Cookie.
    const persistence = clientPersistence.cookie('locale')
    const headers = await persistence.write(
      { request: new Request('https://example.com') },
      'en',
    )
    expect(headers).toEqual({ 'Set-Cookie': 'locale=en; Path=/; SameSite=Lax' })
  })

  it('clientPersistence.cookie lets options override the default during an SSR action', async () => {
    const persistence = clientPersistence.cookie('locale', {
      sameSite: 'None',
      secure: true,
      httpOnly: true,
    })
    const headers = await persistence.write(
      { request: new Request('https://example.com') },
      'en',
    )
    expect(headers).toEqual({
      'Set-Cookie': 'locale=en; Path=/; SameSite=None; Secure; HttpOnly',
    })
  })
})

describe('session persistence', () => {
  // Minimal in-memory SessionStorage stub mirroring React Router's
  // createCookieSessionStorage semantics: getSession reads from a cookie header,
  // commitSession returns a Set-Cookie value and persists to the jar.
  function createSessionStorage(jar: {
    cookie: string
  }): Pick<SessionStorage, 'getSession' | 'commitSession'> {
    let data: Record<string, unknown> = {}
    let loaded = false
    return {
      async getSession(cookieHeader?: string | null) {
        if (!loaded && cookieHeader) {
          for (const part of cookieHeader.split(';')) {
            const [k, ...rest] = part.trim().split('=')
            if (k === 'session' && rest.join('='))
              data = JSON.parse(decodeURIComponent(rest.join('=')))
          }
        }
        loaded = true
        return {
          id: '',
          get data() {
            return data
          },
          get: (key: string) => data[key],
          set: (key: string, value: unknown) => {
            data[key] = value
          },
          unset: (key: string) => {
            delete data[key]
          },
          has: (key: string) => key in data,
          flash: (key: string, value: unknown) => {
            data[key] = value
          },
        } as never
      },
      async commitSession(_session: unknown, options?: CookieSerializeOptions) {
        const maxAge =
          options && 'maxAge' in options
            ? (options as { maxAge?: number }).maxAge
            : undefined
        const cookie = `session=${encodeURIComponent(JSON.stringify(data))}${maxAge ? `; Max-Age=${maxAge}` : ''}`
        jar.cookie = cookie
        return cookie
      },
    }
  }

  it('reads a locale previously committed to the session', async () => {
    const jar = {
      cookie: `session=${encodeURIComponent(JSON.stringify({ locale: 'ar' }))}`,
    }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage)

    const request = new Request('https://example.com', {
      headers: { Cookie: jar.cookie },
    })
    expect(await persistence.read?.({ request })).toBe('ar')
  })

  it('returns null when the session has no locale yet', async () => {
    const storage = createSessionStorage({ cookie: '' })
    const persistence = serverPersistence.session(storage)

    expect(
      await persistence.read?.({ request: new Request('https://example.com') }),
    ).toBeNull()
  })

  it('writes the locale and returns a Set-Cookie from commitSession', async () => {
    const jar = { cookie: '' }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage)

    const result = await persistence.write(
      { request: new Request('https://example.com') },
      'en',
    )

    expect(result).toEqual({
      'Set-Cookie': `session=${encodeURIComponent(JSON.stringify({ locale: 'en' }))}`,
    })
    expect(jar.cookie).toContain('locale')
  })

  it('uses a custom key', async () => {
    const jar = { cookie: '' }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage, { key: 'lang' })

    await persistence.write(
      { request: new Request('https://example.com') },
      'ar',
    )

    const written = JSON.parse(
      decodeURIComponent(jar.cookie.replace(/^session=/, '')),
    )
    expect(written).toEqual({ lang: 'ar' })
  })

  it('forwards commitOptions to commitSession', async () => {
    const jar = { cookie: '' }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage, {
      commitOptions: { maxAge: 900 } as never,
    })

    const result = await persistence.write(
      { request: new Request('https://example.com') },
      'en',
    )

    expect(result).toEqual({
      'Set-Cookie': `session=${encodeURIComponent(JSON.stringify({ locale: 'en' }))}; Max-Age=900`,
    })
  })

  it('round-trips a write then read', async () => {
    const jar = { cookie: '' }
    const storage = createSessionStorage(jar)
    const persistence = serverPersistence.session(storage)

    await persistence.write(
      { request: new Request('https://example.com') },
      'ar',
    )
    const read = await persistence.read?.({
      request: new Request('https://example.com', {
        headers: { Cookie: jar.cookie },
      }),
    })
    expect(read).toBe('ar')
  })
})
