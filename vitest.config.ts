import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    dir: 'tests',
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/index.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
