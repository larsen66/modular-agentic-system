import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

// Island test runner (apps/next). Mirrors vite.config.ts aliases (`@` → src, `@core` → legacy
// core) so tests import exactly as source does. jsdom env + a global setup that polyfills the
// browser APIs HeroUI/React-Aria need. The Tailwind plugin is intentionally omitted — tests
// assert behavior + a11y, not computed styles.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('../../src', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // clearMocks resets call history between tests; we deliberately DON'T restoreMocks, since
    // that would wipe the implementations set inside vi.mock() factories after the first test.
    clearMocks: true,
    restoreMocks: false,
    // Dummy Supabase creds so the shared @core client constructs at import without a real
    // backend. Tests never make network calls — data is supplied via props or mocked seams —
    // this only stops `createClient(undefined, …)` from throwing on module load.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-anon-key',
    },
  },
})
