import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The API is called same-origin under /api (see src/api/client.ts), so both
// the dev server and `vite preview` proxy it to the backend. The container
// does the same in nginx (frontend/nginx.conf).
const apiProxy = {
  '/api': {
    target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
    changeOrigin: true,
    rewrite: (requestPath: string) => requestPath.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: apiProxy,
  },
  preview: {
    port: 4173,
    host: true,
    proxy: apiProxy,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
    // The opt-in live suites run against a real backend on the default port.
    // Without this they resolve `/api` against jsdom's origin and fail, which
    // made the command documented in the README (RELAY_LIVE_API=1 only) wrong.
    // Hermetic suites stub fetch, so this default does not affect them.
    env: {
      VITE_API_BASE_URL: 'http://localhost:3000',
    },
  },
})