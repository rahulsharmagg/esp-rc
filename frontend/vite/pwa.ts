
import { VitePWA } from 'vite-plugin-pwa';

export default VitePWA({
  registerType: 'autoUpdate',
  includeAssets: [
    'assets/logo.svg',
    'assets/logo.png',
    'assets/icons/esp-rc.svg',
    'assets/icons/esp-rc.png'
  ],
  manifest: {
    id: 'ESP-RC-V1',
    name: 'ESP-RC',
    short_name: 'ESP-RC',
    description: 'High-Performance Web Bluetooth & Wi-Fi RC Car Cockpit',
    theme_color: '#ffffff',
    background_color: '#f0f2f5',
    display: 'fullscreen',
    display_override: [
      'fullscreen',
      'standalone',
      'window-controls-overlay'
    ],
    orientation: 'landscape',
    start_url: './',
    icons: [
      {
        src: 'assets/icons/esp-rc.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable'
      },
      {
        src: 'assets/icons/esp-rc.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  },
  workbox: {
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    navigateFallbackDenylist: [
      /^\/firmware\//,
      /^\/progress/,
      /^\/versions/,
      /^\/admin/
    ],
    globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
    runtimeCaching: [
      {
        urlPattern: ({ url }) =>
          [
            '/firmware/',
            '/admin/api/',
            '/progress/',
            '/versions/'
          ].some(path => url.pathname.startsWith(path)),
        handler: 'NetworkOnly'
      },
      {
        urlPattern: ({ request }) =>
          request.destination === 'document',
        handler: 'NetworkFirst',
        options: { cacheName: 'html-cache' }
      },
      {
        urlPattern: ({ request, url }) =>
          request.destination === 'image' ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.png'),
        handler: 'CacheFirst',
        options: {
          cacheName: 'images-cache',
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 30 * 24 * 60 * 60
          }
        }
      }
    ]
  }
});
