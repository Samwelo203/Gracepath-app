import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'logo.png'],
      manifest: {
        name: 'Grace Path Centre Management System',
        short_name: 'Grace Path',
        description: 'Patient, admission, billing and payment management for Grace Path Centre.',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0f172a',
        icons: [
          { src: 'icons/gracepath-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/gracepath-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globIgnores: ['payment.html'],
        navigateFallbackDenylist: [/^\/api\//, /^\/pay\//],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  base: '/app/',
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      // FastAPI endpoints
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
      // Static payer portal (payment.html)
      '/pay': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})