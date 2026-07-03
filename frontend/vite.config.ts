import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
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
            src: '/icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/([a-c]\.)?tile\.openstreetmap\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 512, maxAgeSeconds: 7 * 24 * 60 * 60 },
              networkTimeoutSeconds: 8,
            },
          },
          {
            urlPattern: /^https:\/\/server\.arcgisonline\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'esri-tiles',
              expiration: { maxEntries: 512, maxAgeSeconds: 7 * 24 * 60 * 60 },
              networkTimeoutSeconds: 8,
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
        },
      },
    },
  },
});
