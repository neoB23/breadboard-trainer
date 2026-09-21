import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Phase 0 task 9: single origin in dev and prod, so CORS never enters the project.
    proxy: {
      '/api': {
        // Overridable so the e2e suite can run its own API beside a live
        // `npm run dev` instead of silently talking to it. Dev stays 3001.
        target: `http://127.0.0.1:${process.env['API_PORT']?.trim() || '3001'}`,
        changeOrigin: false,
      },
    },
  },
})
