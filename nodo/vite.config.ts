import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Inyecta Eruda (consola/inspector dentro del teléfono) SOLO en el servidor de desarrollo.
const erudaDev = (): Plugin => ({
  name: 'eruda-dev',
  apply: 'serve',
  transformIndexHtml: () => [
    { tag: 'script', attrs: { src: 'https://cdn.jsdelivr.net/npm/eruda' }, injectTo: 'head-prepend' },
    { tag: 'script', children: 'window.eruda && eruda.init();', injectTo: 'head-prepend' },
  ],
})

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    // Permite el dominio aleatorio del túnel (*.trycloudflare.com / ngrok).
    allowedHosts: true,
    // HMR dinámico: puerto 443 wss solo si hay túnel (TUNNEL=1), localmente usa el puerto normal de Vite (3000).
    hmr: process.env.TUNNEL ? { clientPort: 443, protocol: 'wss' } : true,
  },
  plugins: [
    erudaDev(),
    react(),
    tailwindcss(),
    VitePWA({
      // Service worker propio (src/sw.ts): precache del app shell + fallback de navegación.
      // Los pesos del modelo los guarda WebLLM en la Cache API por su cuenta.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      manifest: {
        name: 'Jinx · IA 100% offline',
        short_name: 'Jinx',
        description:
          'Agente de IA que se instala una vez y funciona para siempre sin internet: chat, documentos con citas y código.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#000000',
        theme_color: '#000000',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,wasm,json,md,onnx}'],
        // Los bundles de WebLLM y ONNX Runtime superan el límite de 2 MiB.
        maximumFileSizeToCacheInBytes: 35 * 1024 * 1024,
      },
      devOptions: { enabled: false },
    }),
  ],
  // Workers como módulos ES (necesario para que WebLLM se divida en chunks dentro del worker).
  worker: { format: 'es' },
})
