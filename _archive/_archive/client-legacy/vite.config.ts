import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Nodig voor Cloudflare tunnels & lokaal netwerk
    allowedHosts: true, // true accepteert alle hosts (universeel voor publiek gebruik)
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:6000',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
