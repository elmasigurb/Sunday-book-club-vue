import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ?? process.env.SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !publishableKey) {
  throw new Error('A Supabase URL and publishable key are required for the client audit')
}

const supabase = createClient(new URL(supabaseUrl).origin, publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

async function expectReadable(
  label: string,
  request: PromiseLike<{ error: { message: string } | null }>,
) {
  const { error } = await request
  if (error) throw new Error(`${label} should be publicly readable: ${error.message}`)
}

async function expectDenied(table: string) {
  const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' })
  if (!error) throw new Error(`${table} unexpectedly allowed an anonymous read`)
}

async function expectRpcDenied(functionName: string, args: Record<string, string> = {}) {
  const { error } = await supabase.rpc(functionName, args)
  if (!error) throw new Error(`${functionName} unexpectedly allowed anonymous execution`)
}

async function auditSupabaseClient() {
  await Promise.all([
    expectReadable('book catalogue', supabase.from('book_catalog').select('*').limit(1)),
    expectReadable('homepage meetings', supabase.from('meetings')
      .select('id, starts_at, ends_at, location, note, book:books!inner(title, author, slug)')
      .eq('status', 'scheduled').limit(1)),
    expectReadable('homepage reviews', supabase.from('reviews')
      .select('id, display_name, initials, quote, rating, color, created_at, book:books!inner(title)')
      .eq('approved', true).limit(1)),
    expectReadable('book clubs', supabase.from('book_club_selections')
      .select('id, status, club:book_clubs!inner(id, slug, name, description), meeting:meetings(id, title, starts_at, location)')
      .in('status', ['planned', 'current']).limit(1)),
    expectReadable('event details', supabase.from('meetings')
      .select('id, title, description, starts_at, ends_at, location, note, capacity, status, book:books!inner(id, slug, title, author, genre, rating, cover_class, cover_kicker), club:book_clubs(id, name, description)')
      .in('status', ['scheduled', 'completed']).limit(1)),
  ])

  await Promise.all([
    expectDenied('members'),
    expectDenied('reading_lists'),
    expectDenied('rsvps'),
    expectRpcDenied('ensure_member_profile'),
    expectRpcDenied('register_for_meeting', { p_meeting_id: crypto.randomUUID() }),
    expectRpcDenied('cancel_meeting_registration', { p_meeting_id: crypto.randomUUID() }),
  ])

  console.log('Supabase browser-client audit passed')
  console.log('Public catalogue data is readable and member data/RPCs reject anonymous access')
}

auditSupabaseClient().catch((error) => {
  console.error('Supabase browser-client audit failed', error)
  process.exit(1)
})
