import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// 약관·개인정보 페이지의 문의 이메일 자리를 빌드할 때 환경변수(VITE_BIZ_EMAIL)로 채워요.
function legalContact(mode) {
  return {
    name: 'legal-contact',
    apply: 'build',
    closeBundle() {
      const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
      const email = (env.VITE_BIZ_EMAIL || '').trim() || '서비스 안 도움말의 ‘사업자 정보·문의’ 항목'
      for (const f of ['privacy.html', 'terms.html']) {
        const p = path.resolve('dist', f)
        if (fs.existsSync(p)) fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replaceAll('__BIZ_EMAIL__', email))
      }
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    legalContact(mode),
    VitePWA({
      // 매니페스트는 public/manifest.webmanifest 를 그대로 써요.
      manifest: false,
      registerType: 'autoUpdate',
      injectRegister: false, // src/lib/pwa.js 에서 직접 등록해요
      workbox: {
        importScripts: ['push-sw.js'],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // 앱 껍데기(코드·스타일·아이콘)만 미리 저장하고, 큰 카드 그림은 쓸 때 저장해요.
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'icon-*.png', 'apple-touch-icon.png'],
        globIgnores: ['**/tarot/**', '**/mascots/**', 'og.png'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/(privacy|terms)/],
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
}))
