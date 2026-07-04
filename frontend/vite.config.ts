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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
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
        },
      },
    },
  },
});
