import { Router } from 'express'
import { z } from 'zod'
import { authenticatedUser, requireAuth } from '../auth.js'
import { pool } from '../db.js'
import { HttpError } from '../errors.js'
import { ensureMember } from '../member-profile.js'

export const rsvpsRouter = Router()
const paramsSchema = z.object({ meetingId: z.string().uuid() })

rsvpsRouter.post('/:meetingId/rsvp', requireAuth, async (request, response) => {
  const { meetingId } = paramsSchema.parse(request.params)
  const user = authenticatedUser(request)
  const client = await pool.connect()

  try {
    await client.query('begin')
    const meetingResult = await client.query<{ capacity: number | null }>(
      `
        select capacity
        from public.meetings
        where id = $1 and status = 'scheduled' and ends_at > now()
        for update
      `,
      [meetingId],
    )
    const meeting = meetingResult.rows[0]
    if (!meeting) throw new HttpError(404, 'This meeting is not available')

    const member = await ensureMember(client, user)
    const attendanceResult = await client.query<{ count: string }>(
      `
        select count(*)::text as count
        from public.rsvps
        where meeting_id = $1 and status = 'attending'
      `,
      [meetingId],
    )
    const attending = Number(attendanceResult.rows[0]?.count ?? 0)
    const status = meeting.capacity !== null && attending >= meeting.capacity
      ? 'waitlisted'
      : 'attending'

    const rsvpResult = await client.query<{ status: 'attending' | 'waitlisted' }>(
      `
        insert into public.rsvps (member_id, meeting_id, status)
        values ($1, $2, $3)
        on conflict (member_id, meeting_id) do update
          set status = excluded.status, updated_at = now()
        returning status
      `,
      [member.id, meetingId, status],
    )
    await client.query('commit')
    response.json({ status: rsvpResult.rows[0]!.status })
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})

rsvpsRouter.delete('/:meetingId/rsvp', requireAuth, async (request, response) => {
  const { meetingId } = paramsSchema.parse(request.params)
  const user = authenticatedUser(request)
  await pool.query(
    `
      update public.rsvps r
      set status = 'cancelled', updated_at = now()
      from public.members m
      where r.member_id = m.id
        and r.meeting_id = $1
        and m.auth_user_id = $2
    `,
    [meetingId, user.id],
  )
  response.status(204).send()
})
