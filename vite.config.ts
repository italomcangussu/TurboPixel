import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';
import { compression } from 'vite-plugin-compression2';

export default defineConfig({
  server: {
    allowedHosts: [
      'nexaescala-turbopixel.ylgf5w.easypanel.host'
    ],
    port: 80,
    host: '0.0.0.0',
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,mp3,ogg,woff2}'],
        // Exclude source/reference vehicle art from precache to keep build under Workbox limits.
        globIgnores: ['assets/vehicles/source/**'],
        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
          {
            urlPattern: /\.(?:mp3|ogg|wav)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio',
              expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: 'TurboPixel',
        short_name: 'TurboPixel',
        description: 'Jogo de arrancada pixel modern com carros customizaveis.',
        theme_color: '#0f1220',
        background_color: '#0f1220',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
    compression({ algorithms: ['gzip', 'brotliCompress'] }),
  ],

  build: {
    target: 'es2022',
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      enabled: false,
    },
  },
});
