import type {
  DetectorKind,
  LocaleInput,
  LocaleMeta,
  LinguiRouterConfig,
  LinguiRouter,
  PersistenceKind,
} from './types'
import { normalizeLocaleCode } from './utils'

function isLocaleCodeList(locales: LocaleInput): locales is readonly string[] {
  return Array.isArray(locales)
}

function normalizeLocales(locales: LocaleInput): LocaleMeta[] {
  if (isLocaleCodeList(locales)) {
    return locales.map((locale) => {
      const code = normalizeLocaleCode(locale)
      return { code, label: code, dir: 'ltr' }
    })
  }

  return Object.entries(locales).map(([locale, meta]) => {
    const code = normalizeLocaleCode(locale)
    return { code, label: meta.label ?? code, dir: meta.dir ?? 'ltr' }
  })
}

function assertLocalesNotEmpty(locales: readonly LocaleMeta[]): void {
  if (locales.length === 0)
    throw new Error('[lingui-rr] config.locales: cannot be empty.')
}

function assertNoDuplicateLocales(locales: readonly LocaleMeta[]): void {
  const duplicates = new Set<string>()
  const seen = new Set<string>()
  for (const locale of locales) {
    const key = locale.code.toLowerCase()
    if (seen.has(key)) duplicates.add(locale.code)
    seen.add(key)
  }

  if (duplicates.size)
    throw new Error(
      `[lingui-rr] config.locales: duplicate locale codes: ${[...duplicates].join(', ')}`,
    )
}

function normalizeRequiredLocale(
  field: 'defaultLocale' | 'fallbackLocale',
  rawLocale: string,
  localeCodes: readonly string[],
): string {
  const locale = normalizeLocaleCode(rawLocale)
  if (!localeCodes.includes(locale)) {
    throw new Error(
      `[lingui-rr] config.${field}: "${rawLocale}" is not one of locales [${localeCodes.join(', ')}].`,
    )
  }
  return locale
}

function assertCatalogs(
  config: LinguiRouterConfig,
  localeCodes: readonly string[],
): void {
  for (const locale of localeCodes) {
    if (!config.catalogs[locale])
      throw new Error(
        `[lingui-rr] config.catalogs: missing catalog loader for locale "${locale}". Provide a catalog for every locale in config.locales.`,
      )
  }
}

type KindedConfigItem = { kind: DetectorKind | PersistenceKind }

function assertServerModeKinds(
  items: readonly KindedConfigItem[],
  configKey: 'detection' | 'persistence',
  server: boolean,
): void {
  const expectedKind = server ? 'server' : 'client'
  const itemLabel = configKey === 'detection' ? 'detector' : 'persistence'
  const expectedLabel = configKey === 'detection' ? 'detectors' : 'persistence'
  const factory = `${expectedKind}${configKey === 'detection' ? 'Detectors' : 'Persistence'}`

  for (const item of items) {
    if (item.kind !== expectedKind)
      throw new Error(
        `[lingui-rr] config.${configKey}: server: ${server} configs can only use ${expectedKind} ${expectedLabel}, got a "${item.kind}" ${itemLabel}. Use ${factory}.* instead.`,
      )
  }
}

function assertDetectorKinds(config: LinguiRouterConfig): void {
  assertServerModeKinds(config.detection ?? [], 'detection', config.server)
}

function assertPersistenceKinds(config: LinguiRouterConfig): void {
  assertServerModeKinds(config.persistence ?? [], 'persistence', config.server)
}

function assertUrlPrefixOptions(config: LinguiRouterConfig): void {
  if (
    config.prefixDefaultLocale !== undefined &&
    config.mode !== 'url-prefix'
  ) {
    throw new Error(
      `[lingui-rr] config.prefixDefaultLocale: only valid when mode is "url-prefix", got mode "${config.mode}".`,
    )
  }
}

export function validateConfig(config: LinguiRouterConfig): LinguiRouter {
  const locales = normalizeLocales(config.locales)
  assertLocalesNotEmpty(locales)
  assertNoDuplicateLocales(locales)

  const localeCodes = locales.map((locale) => locale.code)
  const defaultLocale = normalizeRequiredLocale(
    'defaultLocale',
    config.defaultLocale,
    localeCodes,
  )
  const fallbackLocale = normalizeRequiredLocale(
    'fallbackLocale',
    config.fallbackLocale ?? defaultLocale,
    localeCodes,
  )

  assertCatalogs(config, localeCodes)
  assertDetectorKinds(config)
  assertPersistenceKinds(config)
  assertUrlPrefixOptions(config)

  return { config, locales, localeCodes, defaultLocale, fallbackLocale }
}

export function createLinguiRouter(config: LinguiRouterConfig): LinguiRouter {
  return validateConfig(config)
}
