import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: process.env.VITE_BASE_URL || (process.env.VERCEL === '1' ? '/' : (mode === 'production' ? '/AI-Institutional-Cleaning-Product-Selector/' : '/')),
  build: {
    outDir: 'frontend/dist',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
}))
