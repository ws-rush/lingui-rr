import type { CookieOptions } from './types'

export function normalizeLocaleCode(locale: string): string {
  return locale
    .trim()
    .split('-')
    .filter(Boolean)
    .map((part, index) => {
      const lower = part.toLowerCase()
      if (index === 0) return lower
      if (part.length === 4) return lower[0]!.toUpperCase() + lower.slice(1)
      if (part.length === 2 || part.length === 3) return lower.toUpperCase()
      return lower
    })
    .join('-')
}

export function matchSupportedLocale(candidate: string | null | undefined, supportedLocales: readonly string[], fallbackLocale: string): string {
  if (!candidate) return fallbackLocale
  const supported = supportedLocales.map(normalizeLocaleCode)
  const normalized = normalizeLocaleCode(candidate)
  const exact = supported.find((locale) => locale.toLowerCase() === normalized.toLowerCase())
  if (exact) return exact

  const base = normalized.split('-')[0]
  const baseMatch = supported.find((locale) => locale.toLowerCase() === base?.toLowerCase())
  return baseMatch ?? fallbackLocale
}

export function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const [rawKey, ...rawValue] = part.trim().split('=')
    if (rawKey === name) return decodeURIComponent(rawValue.join('='))
  }
  return null
}

export function parseAcceptLanguage(value: string | null): string | null {
  if (!value) return null
  return value
    .split(',')
    .map((part) => {
      const [locale, ...params] = part.trim().split(';')
      const q = params.find((param) => param.trim().startsWith('q='))?.split('=')[1]
      return { locale, q: q ? Number(q) : 1 }
    })
    .filter((item) => item.locale)
    .sort((a, b) => b.q - a.q)[0]?.locale ?? null
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`]
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`)
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.secure) parts.push('Secure')
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.domain) parts.push(`Domain=${options.domain}`)
  return parts.join('; ')
}

export function safeRedirectPath(path: string): string {
  if (!path.startsWith('/')) return '/'
  // Block protocol-relative and backslash-based open-redirect payloads such as
  // `//evil.com` or `/\evil.com`. Browsers normalize `/` and `\`, so a leading
  // run of either can be interpreted as an absolute off-site URL.
  if (/^[\\/]{2}/.test(path)) return '/'
  return path
}

export function appendHeaders(target: Headers, init: HeadersInit | void): void {
  if (!init) return
  new Headers(init).forEach((value, key) => target.append(key, value))
}

export function appendDataSuffix(path: string): string {
  const url = new URL(path, 'https://example.com')
  const pathname = `${url.pathname}.data`
  return `${pathname}${url.search}${url.hash}`
}
