import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

const denCoreTarget = process.env.VITE_DEV_DEN_CORE_TARGET ?? 'http://localhost:5299'

export default defineConfig({
  plugins: [react()],
  root: 'apps/web',
  publicDir: 'public',
  resolve: {
    alias: {
      '@den-web/api': fileURLToPath(new URL('./packages/api/src', import.meta.url)),
      '@den-web/features': fileURLToPath(new URL('./packages/features/src', import.meta.url)),
      '@den-web/models': fileURLToPath(new URL('./packages/models/src', import.meta.url)),
      '@den-web/shared': fileURLToPath(new URL('./packages/shared/src', import.meta.url)),
      '@den-web/shell': fileURLToPath(new URL('./packages/shell/src', import.meta.url)),
      '@den-web/ui': fileURLToPath(new URL('./packages/ui/src', import.meta.url)),
    },
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react') || id.includes('/node_modules/react-dom')) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/den-core-api': {
        target: denCoreTarget,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/den-core-api/, ''),
      },
    },
  },
  test: {
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: [
      'apps/**/*.{test,spec}.?(c|m)[jt]s?(x)',
      'packages/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
  },
})
