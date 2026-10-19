import { pool } from '../db.js'

async function auditMemberFlows() {
  const client = await pool.connect()
  let transactionOpen = false

  try {
    await client.query('begin')
    transactionOpen = true

    const userResult = await client.query<{ id: string }>(`
      select u.id
      from auth.users as u
      where u.email is not null
      order by u.created_at desc
      limit 1
    `)
    const meetingResult = await client.query<{ id: string }>(`
      select m.id
      from public.meetings as m
      where m.status = 'scheduled' and m.ends_at > now()
      order by m.starts_at
      limit 1
    `)
    const bookResult = await client.query<{ id: string }>(`
      select b.id
      from public.books as b
      where b.published = true
      order by b.display_order, b.created_at
      limit 1
    `)

    const authUserId = userResult.rows[0]?.id
    const meetingId = meetingResult.rows[0]?.id
    const bookId = bookResult.rows[0]?.id
    if (!authUserId || !meetingId || !bookId) {
      throw new Error('The member-flow audit needs an Auth user, a future scheduled meeting, and a published book')
    }

    const claims = JSON.stringify({ sub: authUserId, role: 'authenticated' })
    await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [authUserId])
    await client.query('set local role authenticated')

    const profileResult = await client.query<{ member_id: string }>(
      'select member_id from public.ensure_member_profile()',
    )
    const memberId = profileResult.rows[0]?.member_id
    if (!memberId) throw new Error('ensure_member_profile did not return a member')

    const currentMemberResult = await client.query<{ member_id: string | null }>(
      'select public.current_member_id() as member_id',
    )
    if (currentMemberResult.rows[0]?.member_id !== memberId) {
      throw new Error('current_member_id did not resolve the authenticated member')
    }

    const profileUpdate = await client.query(`
      update public.members as m
      set display_name = m.display_name
      where m.id = $1
      returning m.id
    `, [memberId])
    if (profileUpdate.rowCount !== 1) throw new Error('The member could not update their own profile')

    const shelfResult = await client.query(`
      insert into public.reading_lists as rl (member_id, book_id, status)
      values ($1, $2, 'want_to_read')
      on conflict (member_id, book_id) do update
        set status = excluded.status
      returning rl.id
    `, [memberId, bookId])
    if (shelfResult.rowCount !== 1) throw new Error('The member bookshelf write did not succeed')

    const ownReview = await client.query<{ id: string; quote: string; rating: number }>(`
      select r.id, r.quote, r.rating
      from public.reviews as r
      where r.member_id = $1
      limit 1
    `, [memberId])
    if (ownReview.rows[0]) {
      const reviewResult = await client.query(`
        update public.reviews as r
        set quote = $2, rating = $3, approved = false
        where r.id = $1
        returning r.id
      `, [ownReview.rows[0].id, ownReview.rows[0].quote, ownReview.rows[0].rating])
      if (reviewResult.rowCount !== 1) throw new Error('The member review update did not succeed')
    } else {
      const reviewBook = await client.query<{ id: string }>(`
        select b.id
        from public.books as b
        where b.published = true
          and not exists (
            select 1 from public.reviews as r
            where r.book_id = b.id and r.member_id = $1
          )
        order by b.display_order, b.created_at
        limit 1
      `, [memberId])
      if (!reviewBook.rows[0]) throw new Error('No book is available for the review-write audit')

      const reviewResult = await client.query(`
        insert into public.reviews as r (
          member_id, book_id, display_name, initials, quote, rating, color, approved
        )
        select $1, $2, m.display_name, 'QA', 'Rollback-only moderation audit.', 5, 'pink', false
        from public.members as m
        where m.id = $1
        returning r.id
      `, [memberId, reviewBook.rows[0].id])
      if (reviewResult.rowCount !== 1) throw new Error('The member review insert did not succeed')
    }

    const registration = await client.query<{ registration_status: string }>(
      'select registration_status from public.register_for_meeting($1)',
      [meetingId],
    )
    if (!['attending', 'waitlisted'].includes(registration.rows[0]?.registration_status ?? '')) {
      throw new Error('Event registration did not return a valid status')
    }

    await client.query('select public.cancel_meeting_registration($1)', [meetingId])
    const cancelled = await client.query<{ status: string }>(`
      select r.status
      from public.rsvps as r
      where r.member_id = $1 and r.meeting_id = $2
    `, [memberId, meetingId])
    if (cancelled.rows[0]?.status !== 'cancelled') {
      throw new Error('Event cancellation did not produce the cancelled status')
    }

    console.log('Authenticated member-flow audit passed')
    console.log('Profile, bookshelf, review, registration, and cancellation checks succeeded')
  } finally {
    if (transactionOpen) await client.query('rollback')
    client.release()
    await pool.end()
  }
}

auditMemberFlows().catch((error) => {
  console.error('Authenticated member-flow audit failed', error)
  process.exit(1)
})
