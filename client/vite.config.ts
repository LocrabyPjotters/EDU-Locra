import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Dedupliceer React — voorkomt "Invalid hook call" door meerdere React-kopieën
    // De _archive/client-legacy/node_modules leverde een eigen scheduler/react mee
    alias: {
      'react': path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
      'scheduler': path.resolve('./node_modules/scheduler'),
    },
    // Sluit _archive helemaal uit van module-resolutie
    dedupe: ['react', 'react-dom', 'scheduler'],
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    cors: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        ws: true
      }
    }
  }
})
