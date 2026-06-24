// Access-layer seam (Constitution v1.3.0 Principle X). Holds the shared legacy Supabase client.
//
// CORE-INTERNAL: only other `src/core/**` modules may import this file. Nothing in features/,
// shared/, app/, pages/, etc. may import the client — directly OR through this re-export. They
// consume TYPED operations from `core/*` (e.g. `core/session`) instead. The guard
// (`apps/next/scripts/check-island-boundaries.mjs`) resolves paths and fails on any client
// import outside core/, so the seam is a real boundary, not a naming convention.
//
// The client is imported (not copied) from the reused legacy core via `@core/* → ../../src/*`.
export { supabase } from '@core/integrations/supabase/client'
