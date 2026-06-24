import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Island app (apps/next) grafted onto the custom TS kernel.
//
// Backend seam (all in src/core/**):
//   - run execution (chat run + preview)  → the KERNEL (Fastify). Dev: `/__kernel` proxy → :3000;
//                                            override target with VITE_KERNEL_PROXY_TARGET, or pin a
//                                            direct origin with VITE_KERNEL_URL (see src/core/kernel.ts).
//   - data (auth / projects / chats / …)  → BOS-prod Supabase, via the VENDORED client under ./vendor.
//
// `@core`/`@shared` resolve to vendored legacy code under ./vendor so this app is SELF-CONTAINED —
// it no longer depends on a sibling vbp-german checkout (was `../../src` + `../../shared`).
export default defineConfig({
  base: '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./vendor', import.meta.url)),
      '@shared': fileURLToPath(new URL('./vendor/shared', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 8081,
    // Pin to 8081 deterministically (fail loudly if busy) so the localhost origin is stable for the
    // Supabase redirect-URL allowlist — no silent drift to 8082.
    strictPort: true,
    proxy: {
      // Run-execution lane → the kernel (Fastify on :3000 in dev).
      '/__kernel': {
        target: process.env.VITE_KERNEL_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__kernel/, ''),
      },
      // Non-core runner calls (files / diff / child-mount) still target the legacy runner.
      '/__runner': {
        target: process.env.VITE_RUNNER_PROXY_TARGET || 'https://rundev.cloved.ai',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/__runner/, ''),
      },
    },
  },
})
