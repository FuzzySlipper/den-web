import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const denCoreTarget = process.env.VITE_DEV_DEN_CORE_TARGET ?? 'http://localhost:5299'
const denHostTarget = process.env.VITE_DEV_DEN_HOST_TARGET ?? 'http://localhost:5400'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/den-core-api': {
        target: denCoreTarget,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/den-core-api/, ''),
      },
      '/den-host-api': {
        target: denHostTarget,
        changeOrigin: true,
        rewrite: path => path.replace(/^\/den-host-api/, '/api/host'),
      },
    },
  },
})
