import { matchSupportedLocale, normalizeLocaleCode } from './utils'

export const defaultIgnorePaths: Array<RegExp | string> = [
  /^\/assets\//,
  /^\/build\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/manifest\.webmanifest$/,
  /^\/api\//,
]

export function isIgnoredPath(pathname: string, ignorePaths: Array<RegExp | string> = defaultIgnorePaths): boolean {
  return ignorePaths.some((pattern) => (typeof pattern === 'string' ? pathname.startsWith(pattern) : pattern.test(pathname)))
}

export function looksLikeLocale(segment: string): boolean {
  return /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(segment)
}

export function rewriteLocalePath(
  path: string,
  targetLocale: string,
  supportedLocales: readonly string[],
  options: { defaultLocale?: string; prefixDefaultLocale?: boolean; ignorePaths?: Array<RegExp | string> } = {},
): string {
  const url = new URL(path, 'https://example.com')
  if (isIgnoredPath(url.pathname, options.ignorePaths ?? defaultIgnorePaths)) return `${url.pathname}${url.search}${url.hash}`

  const target = matchSupportedLocale(targetLocale, supportedLocales, options.defaultLocale ?? supportedLocales[0]!)
  const prefixDefaultLocale = options.prefixDefaultLocale ?? true
  const defaultLocale = options.defaultLocale ? normalizeLocaleCode(options.defaultLocale) : undefined
  const segments = url.pathname.split('/').filter(Boolean)
  const first = segments[0]
  const firstSupported = first ? matchSupportedLocale(first, supportedLocales, '') : ''

  if (first && (firstSupported || looksLikeLocale(first))) segments.shift()

  const shouldPrefix = !(prefixDefaultLocale === false && defaultLocale && target === defaultLocale)
  const nextSegments = shouldPrefix ? [target, ...segments] : segments
  const pathname = `/${nextSegments.join('/')}`.replace(/\/$/, '') || '/'
  return `${pathname}${url.search}${url.hash}`
}
