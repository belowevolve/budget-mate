import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'budgetmate:content-security-policy',
      apply: 'build',
      transformIndexHtml: () => [{
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
        injectTo: 'head-prepend',
      }],
    },
    VitePWA({
      injectRegister: 'script',
      devOptions: { enabled: true, suppressWarnings: true },
      manifest: {
        name: 'budgetmate',
        short_name: 'budgetmate',
        description: 'Учёт расходов и доходов с локальным импортом банковских выписок.',
        lang: 'ru',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#f7f8f2',
        background_color: '#f7f8f2',
        icons: [
          { src: 'icons/budgetmate-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/budgetmate-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/budgetmate-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['notification-events.js'],
        navigateFallback: command === 'serve' ? undefined : 'index.html',
        globPatterns: ['**/*.{js,mjs,css,html,png,svg,woff2,wasm,bcmap,ttf,pfb}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
}))
