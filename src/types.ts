import type { Messages } from '@lingui/core'

export type LocaleDirection = 'ltr' | 'rtl' | 'auto'
export type LocaleMeta = { code: string; label: string; dir: LocaleDirection }
export type LocaleInput = readonly string[] | Record<string, Partial<Omit<LocaleMeta, 'code'>>>
export type CatalogModule = { messages?: Messages } | Messages
export type CatalogLoader = () => Promise<CatalogModule>
export type Mode = 'url-prefix' | 'context'

export type DetectorKind = 'server' | 'client'
export type PersistenceKind = 'server' | 'client'

export type ServerDetectorContext = { request: Request }
export type ClientDetectorContext = { request?: Request }
export type ServerPersistenceContext = { request: Request }
export type ClientPersistenceContext = { request?: Request }

export type Detector<Kind extends DetectorKind = DetectorKind> = {
  kind: Kind
  detect(ctx: Kind extends 'server' ? ServerDetectorContext : ClientDetectorContext): Promise<string | null> | string | null
}

export type Persistence<Kind extends PersistenceKind = PersistenceKind> = {
  kind: Kind
  read?(ctx: Kind extends 'server' ? ServerPersistenceContext : ClientPersistenceContext): Promise<string | null> | string | null
  write(ctx: Kind extends 'server' ? ServerPersistenceContext : ClientPersistenceContext, locale: string): Promise<void | HeadersInit> | void | HeadersInit
}

export type BaseConfig<Server extends boolean> = {
  server: Server
  mode: Mode
  locales: LocaleInput
  defaultLocale: string
  fallbackLocale?: string
  catalogs: Record<string, CatalogLoader>
  detection?: Array<Server extends true ? Detector<'server'> : Detector<'client'>>
  persistence?: Array<Server extends true ? Persistence<'server'> : Persistence<'client'>>
  prefixDefaultLocale?: boolean
  ignorePaths?: Array<RegExp | string>
}

export type LinguiRouterConfig = BaseConfig<true> | BaseConfig<false>

export type LinguiRouter = {
  config: LinguiRouterConfig
  locales: LocaleMeta[]
  localeCodes: string[]
  defaultLocale: string
  fallbackLocale: string
}

export type LinguiRootLoaderData = {
  locale: string
  localeMeta: LocaleMeta
  locales: LocaleMeta[]
  messages: Messages
  htmlAttrs: { lang: string; dir: LocaleDirection }
}

export type LinguiState = LinguiRootLoaderData

/**
 * Serialization options for a locale cookie. Mirrors the subset of RFC 6265
 * attributes relevant to locale persistence. Used by `serializeCookie()` and the
 * cookie persistence adapters.
 *
 * `httpOnly` is honored by browsers only when set via a server `Set-Cookie`
 * header; writing it through `document.cookie` in the browser is a no-op.
 */
export type CookieOptions = {
  path?: string
  maxAge?: number
  sameSite?: 'Lax' | 'Strict' | 'None'
  secure?: boolean
  httpOnly?: boolean
  domain?: string
}
