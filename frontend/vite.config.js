import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 매니페스트는 public/manifest.webmanifest 를 그대로 써요.
      manifest: false,
      registerType: 'autoUpdate',
      injectRegister: false, // src/lib/pwa.js 에서 직접 등록해요
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // 앱 껍데기(코드·스타일·아이콘)만 미리 저장하고, 큰 카드 그림은 쓸 때 저장해요.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icon-*.png', 'apple-touch-icon.png'],
        globIgnores: ['**/tarot/**', '**/mascots/**', 'og.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // 서버 요청은 절대 저장하지 않아요(코인·상담 내용이 낡아 보이면 안 돼요).
          { urlPattern: ({ url }) => url.pathname.startsWith('/api/') || url.hostname.endsWith('onrender.com'), handler: 'NetworkOnly' },
          {
            urlPattern: ({ url }) => /\/(tarot|mascots)\//.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'art', expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 60 } },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8008',
        changeOrigin: true
      }
    }
  }
})
