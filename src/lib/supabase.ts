import { createClient } from '@supabase/supabase-js'

// Publishable values; safe in the browser. Row level security protects the data.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://mcsnkmfyqvzpdfeffvzi.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_O3PwqAH5DKN86WcHIuTnNw_4apN1vU9'

export const sb = createClient(SUPABASE_URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'downsizing.auth' } })

// Handy for support and automated tests.
;(window as unknown as { __sb: typeof sb }).__sb = sb
