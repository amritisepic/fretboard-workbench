import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serves the site from /<repository-name>/; the deploy workflow passes that path in.
  base: process.env.BASE_PATH ?? '/',
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
    // Node by default, so the theory and state tests stay fast. Component tests opt into jsdom with
    // a `@vitest-environment jsdom` docblock; see src/test/setup.ts.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
    // The design-token tests read the real stylesheet through `?inline`; without this vitest hands
    // back an empty string for any CSS import. No component test imports CSS, so this costs nothing
    // elsewhere.
    css: true,
  },
});
