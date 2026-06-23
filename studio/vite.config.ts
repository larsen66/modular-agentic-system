import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Studio dev server proxies API calls to the kernel server (default port
// 3000) so the browser can hit /message, /registry, /preview same-origin (no
// CORS dance). KERNEL_URL overrides the target when 3000 is taken.
const KERNEL = process.env.KERNEL_URL ?? 'http://localhost:3000';
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/message': { target: KERNEL, changeOrigin: true },
      '/registry': { target: KERNEL, changeOrigin: true },
      '/preview': { target: KERNEL, changeOrigin: true },
      '/history': { target: KERNEL, changeOrigin: true },
      '/health': { target: KERNEL, changeOrigin: true },
      '/architecture': { target: KERNEL, changeOrigin: true },
      '/auth': { target: KERNEL, changeOrigin: true },
      '/projects': { target: KERNEL, changeOrigin: true },
    },
  },
});
