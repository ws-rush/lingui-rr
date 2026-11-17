// Auto-generated fixture. SSR (server: true), mode: context.
import { createLinguiRouter, rewriteLocalePath, serverDetectors, serverPersistence } from 'lingui-rr'

export const defaultLocale = 'en'

export const i18n = createLinguiRouter({
  server: true,
  mode: 'context',
  locales: {
  en: { label: 'English', dir: 'ltr' },
  ar: { label: 'العربية', dir: 'rtl' },
  },
  defaultLocale: 'en',
  detection: [serverDetectors.cookie('locale'), serverDetectors.acceptLanguage()],
  persistence: [serverPersistence.cookie('locale')],
  ignorePaths: [/^\/assets\//, /^\/api\//, /^\/change-locale(?:\.data)?$/],
  catalogs: {
      en: async () => ({
        messages: {
          greeting: 'Hello from lingui-rr',
          aboutLink: 'About',
          aboutTitle: 'About lingui-rr',
          aboutBody: 'About page content',
          homeLink: 'Home',
        },
      }),
      ar: async () => ({
        messages: {
          greeting: 'مرحبا من lingui-rr',
          aboutLink: 'حول',
          aboutTitle: 'حول lingui-rr',
          aboutBody: 'محتوى صفحة حول',
          homeLink: 'الرئيسية',
        },
      }),
  },
})

export function localizePath(path: string, locale: string): string {
  if (i18n.config.mode !== 'url-prefix') return path
  return rewriteLocalePath(path, locale, i18n.localeCodes, {
    defaultLocale: i18n.defaultLocale,
    prefixDefaultLocale: i18n.config.prefixDefaultLocale,
    ignorePaths: i18n.config.ignorePaths,
  })
}
