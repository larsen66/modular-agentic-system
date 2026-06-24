import { createClient } from '@supabase/supabase-js';
import { supabaseAuthLock } from './authLock';
import type { Database } from './types';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const secureAuthSessionFlag = import.meta.env.VITE_SECURE_AUTH_SESSION;
const secureAuthSession = secureAuthSessionFlag === '1' || secureAuthSessionFlag === 'true';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: secureAuthSession ? undefined : localStorage,
    persistSession: secureAuthSession ? false : true,
    autoRefreshToken: secureAuthSession ? false : true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    lock: supabaseAuthLock,
  }
});
