import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabase = createClient(new URL(supabaseUrl).origin, supabaseKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
