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

    console.log(`RLS audit passed for ${policies.rows.length} application tables`)
    console.log('Browser roles cannot bypass API registration or attendance checks')
  } finally {
    client.release()
    await pool.end()
  }
}

auditRls().catch((error) => {
  console.error('RLS audit failed', error)
  process.exit(1)
})
