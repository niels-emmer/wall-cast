import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
