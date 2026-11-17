import { describe, expect, it, vi } from 'vitest'

const setupI18nCalls: any[] = []
vi.mock('@lingui/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@lingui/core')>()
  return {
    ...original,
    setupI18n: (...args: any[]) => {
      setupI18nCalls.push(args)
      return original.setupI18n(...args)
    },
  }
})

import { loadLinguiState, createLinguiRouter } from '../src/index'

describe('loadLinguiState performance', () => {
  it('does not call setupI18n inside loadLinguiState', async () => {
    const i18nRouter = createLinguiRouter({
      server: true,
      mode: 'context',
      locales: ['en'],
      defaultLocale: 'en',
      catalogs: {
        en: async () => ({ hello: 'Hello' }),
      },
    })
    setupI18nCalls.length = 0
    await loadLinguiState(i18nRouter, 'en')
    expect(setupI18nCalls.length).toBe(0)
  })
})
