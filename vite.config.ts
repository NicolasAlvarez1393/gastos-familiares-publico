import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // La versión nueva toma el control sola (skipWaiting + clientsClaim). El registro lo hace
      // src/app/actualizar.ts (no el script del plugin): además pregunta por versiones nuevas al
      // volver al frente y recarga la pantalla en un momento que no moleste.
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Gastos Familiares',
        short_name: 'Gastos',
        description: 'El balance de la casa: gastos, ingresos y cuotas.',
        lang: 'es-AR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f9',
        theme_color: '#f6f7f9',
        // Atajos al mantener apretado el ícono (Chrome en Android; el iPhone no los muestra).
        // Los lee src/app/inicio.ts.
        shortcuts: [
          {
            name: 'Cargar un gasto',
            short_name: 'Gasto',
            url: '/?cargar=gasto',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Cargar un ingreso',
            short_name: 'Ingreso',
            url: '/?cargar=ingreso',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Ver el mes',
            short_name: 'Mes',
            url: '/?ver=mes',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Explícitos: con injectRegister en false, el plugin ya no los pone solo (empírico,
        // 2026-10-17, vite-plugin-pwa 2: el sw.js quedaba esperando un mensaje para activarse).
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        navigateFallback: '/index.html',
        // Las funciones de Netlify (login, token) nunca se sirven desde la caché, y la página
        // de privacidad (estática, la pide Google) no se reemplaza por la app.
        navigateFallbackDenylist: [/^\/api\//, /^\/privacidad/],
      },
    }),
  ],
})
