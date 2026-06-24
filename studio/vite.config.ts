import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Studio dev server proxies API calls to the kernel server (port 3000) so
// the browser can hit /message, /registry, /preview same-origin (no CORS dance).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/message': { target: 'http://localhost:3000', changeOrigin: true },
      '/registry': { target: 'http://localhost:3000', changeOrigin: true },
      '/preview': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
