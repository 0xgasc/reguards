import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'REGUARDS',
        short_name: 'REGUARDS',
        description: 'Tu programa de lealtad favorito en Guatemala',
        theme_color: '#FFFF00',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/dashboard',
        scope: '/',
        icons: [
          {
            src: '/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
        shortcuts: [
          {
            name: 'Mis Puntos',
            url: '/dashboard',
            description: 'Ver saldo y premios',
          },
          {
            name: 'Explorar',
            url: '/explore',
            description: 'Descubrir restaurantes',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/restaurants\/explore/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'explore-cache',
              expiration: { maxEntries: 1, maxAgeSeconds: 300 },
            },
          },
          {
            urlPattern: /^https:\/\/.*\/api\/rewards/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rewards-cache',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  }
})
