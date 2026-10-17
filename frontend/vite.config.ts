import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: null,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SIGAPS — Gestão das Microáreas',
        short_name: 'SIGAPS',
        description: 'Gestão territorial das microáreas da APS',
        theme_color: '#00A86B',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'pt-BR',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/entrega\//,
          /^\/downloads\//,
          /\.zip$/,
        ],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Imagens do mapa já vistas ficam no celular: abre na hora e gasta menos dados no sinal fraco.
        // Só guarda resposta 200 de pedido CORS (crossOrigin nas camadas). O "mapa preto" de 07/2026
        // veio de guardar resposta opaca (sem CORS), que não dá para conferir.
        runtimeCaching: [
          {
            urlPattern:
              /^https:\/\/(tile\.openstreetmap\.org|[abc]\.tile\.opentopomap\.org|server\.arcgisonline\.com)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sigaps-map-tiles',
              expiration: {
                maxEntries: 800,
                maxAgeSeconds: 7 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/leaflet') || id.includes('react-leaflet')) {
            return 'leaflet';
          }
          if (id.includes('@mui/icons-material')) return 'mui-icons';
          if (id.includes('@mui/material') || id.includes('@emotion')) return 'mui-core';
          if (id.includes('recharts')) return 'charts';
          if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('qrcode')) {
            return 'export-tools';
          }
          if (id.includes('/xlsx/') || id.includes('node_modules/xlsx')) {
            return 'xlsx';
          }
        },
      },
    },
  },
});
