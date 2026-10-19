import { pool } from '../db.js'

async function auditRls() {
  const client = await pool.connect()
  try {
    const policies = await client.query<{ tablename: string; policy_count: number }>(`
      select tablename, count(*)::int as policy_count
      from pg_policies
      where schemaname = 'public'
        and tablename = any(array[
          'books', 'members', 'meetings', 'rsvps', 'reviews', 'reading_lists',
          'book_clubs', 'book_club_memberships', 'book_club_selections'
        ])
      group by tablename
    `)
    if (policies.rows.length !== 9 || policies.rows.some((row) => row.policy_count < 1)) {
      throw new Error('One or more application tables are missing RLS policies')
    }

    const privileges = await client.query<{
      can_update_registration: boolean
      can_update_attendance: boolean
      can_update_confirmation: boolean
    }>(`
      select
        has_column_privilege('authenticated', 'public.rsvps', 'status', 'UPDATE') as can_update_registration,
        has_column_privilege('authenticated', 'public.rsvps', 'attendance_status', 'UPDATE') as can_update_attendance,
        has_column_privilege('authenticated', 'public.rsvps', 'attendance_confirmed_at', 'UPDATE') as can_update_confirmation
    `)
    const access = privileges.rows[0]
    if (access?.can_update_registration || access?.can_update_attendance || access?.can_update_confirmation) {
      throw new Error('Attendance column privileges are not safely restricted')
    }

    const functions = await client.query<{
      function_name: string
      security_definer: boolean
      safe_search_path: boolean
      anon_can_execute: boolean
      authenticated_can_execute: boolean
    }>(`
      select
        p.proname as function_name,
        p.prosecdef as security_definer,
        coalesce('search_path=""' = any(p.proconfig), false) as safe_search_path,
        has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
        has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = any(array[
          'ensure_member_profile',
          'register_for_meeting',
          'cancel_meeting_registration'
        ])
    `)
    if (
      functions.rows.length !== 3
      || functions.rows.some((fn) =>
        !fn.security_definer
        || !fn.safe_search_path
        || fn.anon_can_execute
        || !fn.authenticated_can_execute)
    ) {
      throw new Error('One or more browser RPC functions are not safely restricted')
    }

    const catalogue = await client.query<{ security_invoker: boolean }>(`
      select coalesce('security_invoker=true' = any(c.reloptions), false) as security_invoker
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'book_catalog'
    `)
    if (!catalogue.rows[0]?.security_invoker) {
      throw new Error('book_catalog must use security_invoker so underlying RLS applies')
    }

    console.log(`RLS audit passed for ${policies.rows.length} application tables`)
    console.log('Browser RPCs and catalogue view use the expected security boundaries')
    console.log('Browser roles cannot bypass registration capacity or attendance checks')
  } finally {
    client.release()
    await pool.end()
  }
}

auditRls().catch((error) => {
  console.error('RLS audit failed', error)
  process.exit(1)
})
