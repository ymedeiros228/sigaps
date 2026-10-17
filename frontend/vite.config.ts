import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: null,
      registerType: 'autoUpdate',
      // favicon.svg e os PNGs de public/icons já entram no precache pelo globPatterns;
      // sem isto o plugin os acrescentava de novo (entradas duplicadas no sw.js).
      includeManifestIcons: false,
      manifest: {
        name: 'SIGAPS — Gestão das Microáreas',
        short_name: 'SIGAPS',
        description: 'Gestão territorial das microáreas da APS',
        theme_color: '#00A86B',
        background_color: '#ffffff',
        display: 'standalone',
        lang: 'pt-BR',
        start_url: '/',
        // PNGs gerados do favicon.svg por scripts/generate-icons.mjs. O maskable tem fundo
        // cheio e margem de segurança (o SVG tem cantos transparentes e não serve para isso).
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
            src: '/icons/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
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
        // Fora do cache inicial: pacotes pesados que o ACS não usa (o perfil ACS vai direto
        // para /mapa). PDF (jspdf/html2canvas/canvg/dompurify), planilha (xlsx) e gráficos
        // (recharts, só o dashboard). Continuam no ar e baixam na primeira vez que a tela
        // pede; depois ficam no cache HTTP (/assets/ é immutable no vercel.json).
        // O app (vendor, index, páginas) e o mapa (map, SigapsMap) continuam no precache.
        globIgnores: [
          '**/node_modules/**/*', // padrão do workbox (substituído ao definir a lista)
          '**/assets/pdf-*.js',
          '**/assets/MapPdfDialog-*.js',
          '**/assets/xlsx-*.js',
          '**/assets/charts-*.js',
          // Fonte Inter: só os subconjuntos latinos (português) vão para o precache.
          // Cirílico, grego e vietnamita o navegador só baixa se aparecer esse caractere.
          '**/assets/inter-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2',
        ],
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
    // manifest.json em dist/.vite: o scripts/check-bundle.mjs lê dele o que a tela de login baixa.
    manifest: true,
    rolldownOptions: {
      output: {
        // Divisão do JS em pacotes (opção nativa do Rolldown; substitui o manualChunks).
        // O manualChunks antigo puxava as dependências de cada grupo (inclusive o React)
        // para dentro dos pacotes de gráficos/PDF/mapa, e a tela de login baixava tudo.
        // Aqui o grupo "vendor" (maior prioridade) fica com toda biblioteca que a entrada
        // usa de forma estática (tag $initial: React, MUI, router, React Query...).
        // Os grupos pesados só recebem o que sobra, então ficam fora da tela de login
        // e só baixam quando a rota precisa. O scripts/check-bundle.mjs confere isso.
        codeSplitting: {
          groups: [
            {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              tags: ['$initial'],
              priority: 100,
            },
            {
              // Gráficos: só o dashboard.
              name: 'charts',
              test: /[\\/]node_modules[\\/](recharts|victory-vendor|d3-[^\\/]+)[\\/]/,
              priority: 30,
            },
            {
              // Exportação em PDF/imagem: só quando o usuário pede.
              name: 'pdf',
              test: /[\\/]node_modules[\\/](jspdf|html2canvas|qrcode)[\\/]/,
              priority: 30,
            },
            {
              // O jspdf carrega estes dois sob demanda (import dinâmico). Ficam em pacotes
              // separados, com nome fixo para o workbox.globIgnores reconhecer.
              name: 'pdf-canvg',
              test: /[\\/]node_modules[\\/]canvg[\\/]/,
              priority: 40,
            },
            {
              name: 'pdf-purify',
              test: /[\\/]node_modules[\\/]dompurify[\\/]/,
              priority: 40,
            },
            {
              // Planilha: só na importação dos cadastros.
              name: 'xlsx',
              test: /[\\/]node_modules[\\/]xlsx[\\/]/,
              priority: 30,
            },
            {
              // Mapa: Leaflet e Turf.
              name: 'map',
              test: /[\\/]node_modules[\\/](leaflet|react-leaflet|@react-leaflet|@turf)[\\/]/,
              priority: 20,
            },
            {
              // Componentes e ícones do MUI que só as páginas internas usam: um pacote só,
              // em vez de dezenas de arquivos pequenos (menos pedidos no celular).
              name: 'mui-pages',
              test: /[\\/]node_modules[\\/](@mui|@emotion)[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
});
