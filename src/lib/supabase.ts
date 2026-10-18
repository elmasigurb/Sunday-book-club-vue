import { createClient } from '@supabase/supabase-js'
import { hasSupabaseConfig } from '../config'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabase = hasSupabaseConfig && supabaseUrl && supabaseKey
  ? createClient(new URL(supabaseUrl).origin, supabaseKey, {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  : null
