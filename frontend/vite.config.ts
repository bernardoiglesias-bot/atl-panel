import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: ['.devinapps.com', '.trycloudflare.com', 'localhost'],
    proxy: { '/api': 'http://localhost:8000', '/healthz': 'http://localhost:8000' },
  },
})
