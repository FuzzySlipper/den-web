import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@den-web/components': new URL('./libs/components/src/index.ts', import.meta.url).pathname,
      '@den-web/domain': new URL('./libs/domain/src/index.ts', import.meta.url).pathname,
      '@den-web/platform': new URL('./libs/platform/src/index.ts', import.meta.url).pathname,
      '@den-web/protocol': new URL('./libs/protocol/src/index.ts', import.meta.url).pathname,
      '@den-web/renderer': new URL('./libs/renderer/src/index.ts', import.meta.url).pathname,
      '@den-web/shell': new URL('./libs/shell/src/index.ts', import.meta.url).pathname,
      '@den-web/store': new URL('./libs/store/src/index.ts', import.meta.url).pathname,
      '@den-web/testing-fixtures': new URL('./libs/testing-fixtures/src/index.ts', import.meta.url).pathname,
      '@den-web/theme': new URL('./libs/theme/src/index.ts', import.meta.url).pathname,
      '@den-web/transport': new URL('./libs/transport/src/index.ts', import.meta.url).pathname,
    },
  },
  test: {
    exclude: ['node_modules/**', 'dist/**', 'local/**', 'apps/den-web-e2e/**'],
    passWithNoTests: true,
  },
});
