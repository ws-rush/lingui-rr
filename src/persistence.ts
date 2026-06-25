import type { CookieSerializeOptions, SessionData, SessionStorage } from 'react-router'
import type { Persistence, CookieOptions } from './types'
import { parseCookie, serializeCookie } from './utils'

export const serverPersistence = {
  /**
   * Server cookie persistence. Defaults to `SameSite=Lax; HttpOnly`. Pass
   * `options` to override any attribute (or disable a default by setting it to
   * `false`/`undefined`). For example, `serverPersistence.cookie('locale', {
   * secure: true, domain: '.example.com' })`.
   */
  cookie(name = 'locale', options: CookieOptions = {}): Persistence<'server'> {
    const resolved: CookieOptions = { sameSite: 'Lax', httpOnly: true, ...options }
    return {
      kind: 'server',
      read: ({ request }) => parseCookie(request.headers.get('Cookie'), name),
      write: async (_ctx, locale) => ({ 'Set-Cookie': serializeCookie(name, locale, resolved) }),
    }
  },
  custom(persistence: Omit<Persistence<'server'>, 'kind'>): Persistence<'server'> {
    return { kind: 'server', ...persistence }
  },
  /**
   * Server persistence backed by a React Router `SessionStorage`
   * (`createCookieSessionStorage` / `createSessionStorage`). Reads the locale
   * from the session cookie and, on write, commits the updated session and
   * returns its `Set-Cookie` header.
   *
   * Use this when the locale should live in an existing session cookie (e.g.
   * alongside auth/user data) instead of a dedicated `locale` cookie.
   *
   * ```ts
   * import { createCookieSessionStorage } from 'react-router'
   *
   * const sessionStorage = createCookieSessionStorage({ cookie: { name: 'session', sameSite: 'lax' } })
   *
   * persistence: [serverPersistence.session(sessionStorage)]
   * // or with a custom key + commit options:
   * persistence: [serverPersistence.session(sessionStorage, { key: 'locale', commitOptions: { maxAge: 60 * 60 * 24 * 365 } })]
   * ```
   *
   * @param storage   A `SessionStorage` (or any `{ getSession, commitSession }`).
   * @param options   `key` (default `'locale'`) and `commitOptions` forwarded to
   *                  `commitSession` (e.g. `maxAge`, `secure`).
   */
  session<Data extends SessionData = SessionData>(
    storage: Pick<SessionStorage<Data>, 'getSession' | 'commitSession'>,
    options: { key?: string; commitOptions?: CookieSerializeOptions } = {},
  ): Persistence<'server'> {
    const key = options.key ?? 'locale'
    const { getSession, commitSession } = storage
    return {
      kind: 'server',
      read: async ({ request }) => {
        const session = await getSession(request.headers.get('Cookie'))
        const value = session.get(key as never)
        return typeof value === 'string' ? value : null
      },
      write: async ({ request }, locale) => {
        const session = await getSession(request.headers.get('Cookie'))
        session.set(key as never, locale as never)
        return { 'Set-Cookie': await commitSession(session, options.commitOptions) }
      },
    }
  },
}

export const clientPersistence = {
  /**
   * Client cookie persistence. Defaults to `SameSite=Lax`. `httpOnly` has no
   * effect when written through `document.cookie` in the browser (browsers
   * ignore it), but is preserved if the same adapter persists via a `Set-Cookie`
   * header during a framework-mode SSR action. Pass `options` to override any
   * attribute.
   */
  cookie(name = 'locale', options: CookieOptions = {}): Persistence<'client'> {
    const resolved: CookieOptions = { sameSite: 'Lax', ...options }
    return {
      kind: 'client',
      read: ({ request }) => {
        if (typeof document !== 'undefined') return parseCookie(document.cookie, name)
        return parseCookie(request?.headers.get('Cookie') ?? null, name)
      },
      write: async (_ctx, locale) => {
        const cookie = serializeCookie(name, locale, resolved)
        if (typeof document !== 'undefined') {
          document.cookie = cookie
          return
        }
        return { 'Set-Cookie': cookie }
      },
    }
  },
  localStorage(key = 'locale'): Persistence<'client'> {
    return {
      kind: 'client',
      read: () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
      write: async (_ctx, locale) => {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, locale)
      },
    }
  },
  custom(persistence: Omit<Persistence<'client'>, 'kind'>): Persistence<'client'> {
    return { kind: 'client', ...persistence }
  },
}
