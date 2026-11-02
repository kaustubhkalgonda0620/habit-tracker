// expo-sqlite needs extra wasm/header setup on web, so the session lives in the browser's
// localStorage instead. `web.output` is `server`, so this module also loads during the server
// render, where there's no window: keep the session in memory there and don't refresh tokens.
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local');
}

const inBrowser = typeof window !== 'undefined';

export const supabase = createClient(url, key, {
  auth: {
    // A fixed key (rather than one derived from the project ref) so tests can seed a session.
    storageKey: 'auth:v1',
    storage: inBrowser ? window.localStorage : undefined,
    autoRefreshToken: inBrowser,
    persistSession: inBrowser,
    // Sign-in is by email code, not a redirect link, so there's nothing to read from the URL.
    detectSessionInUrl: false,
  },
});
