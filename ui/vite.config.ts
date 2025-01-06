/// <reference types="vitest" />
/// <reference types="vite/client" />

import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['@vitest/web-worker', './src/tests/setup.ts'],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@electric-sql/pglite", '@electric-sql/pglite/worker'],
  },
  worker: {
    format: 'es',
  },
})
