import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

import pwa from './vite/pwa';
import { build } from './vite/build';
import { proxy } from './vite/proxy';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(`v${pkg.version}`),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toLocaleDateString())
  },

  plugins: [
    react(),
    pwa
  ],

  build,

  optimizeDeps: {
    include: ['@lucide/svelte']
  },

  server: {
    host: true,
    port: 5173,
    proxy
  }
});
