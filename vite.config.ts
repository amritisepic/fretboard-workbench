import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // UpdateNotice registers the worker and asks before reloading into a new version, so an update
      // never interrupts work in progress.
      registerType: 'prompt',
      injectRegister: false,
      // The favicon and touch icon are already matched by globPatterns, and the plugin precaches the
      // manifest and its icons itself, so nothing is listed twice.
      includeManifestIcons: false,
      manifest: {
        name: 'Fretboard Workbench',
        short_name: 'Fretboard',
        description: 'Arpeggio and scale maps across any tuning, with voice leading between chords.',
        theme_color: '#FAF9F7',
        background_color: '#FAF9F7',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell, fonts and icons included, so it runs with no network at all.
        globPatterns: ['**/*.{html,js,css,woff2,png,svg}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
