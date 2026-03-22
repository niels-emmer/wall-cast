import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

const { version } = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    proxy: {
      '/api': {
        // Docker Compose dev: 'http://backend:8000'
        // Standalone (npm run dev outside Docker): 'http://localhost:8000'
        target: process.env.VITE_BACKEND_URL ?? 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
