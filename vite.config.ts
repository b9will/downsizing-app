import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // HTTPS in dev so iOS Safari allows the live camera stream on the LAN.
    ...(command === 'serve' ? [basicSsl()] : []),
    VitePWA({
      // While the app changes daily, never serve a cached copy: this removes the old
      // offline cache from every phone so each visit loads the newest version.
      // Turn offline caching back on before real clients (set selfDestroying to false).
      selfDestroying: true,
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Dot',
        short_name: 'Dot',
        description: 'Walk through your home and tag what stays, moves, or goes.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  server: { host: true, port: 5173 },
}))
