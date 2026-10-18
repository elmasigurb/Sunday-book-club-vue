import { Router } from 'express'
import { z } from 'zod'
import { optionalAuth } from '../auth.js'
import { pool } from '../db.js'
import { HttpError } from '../errors.js'

export const eventsRouter = Router()
const paramsSchema = z.object({ eventId: z.string().uuid() })

eventsRouter.get('/:eventId', optionalAuth, async (request, response) => {
  const { eventId } = paramsSchema.parse(request.params)
  const eventResult = await pool.query<{
    id: string
    title: string | null
    description: string | null
    starts_at: Date
    ends_at: Date
    location: string
    note: string | null
    capacity: number | null
    status: string
    book_id: string
    book_slug: string
    book_title: string
    book_author: string
    book_genre: string
    book_rating: string
    cover_class: string
    cover_kicker: string | null
    club_id: string | null
    club_name: string | null
    club_description: string | null
  }>(`
    select m.id, m.title, m.description, m.starts_at, m.ends_at, m.location,
           m.note, m.capacity, m.status,
           b.id as book_id, b.slug as book_slug, b.title as book_title,
           b.author as book_author, b.genre as book_genre, b.rating as book_rating,
           b.cover_class, b.cover_kicker,
           c.id as club_id, c.name as club_name, c.description as club_description
    from public.meetings m
    join public.books b on b.id = m.book_id
    left join public.book_clubs c on c.id = m.club_id
    where m.id = $1 and m.status in ('scheduled', 'completed')
  `, [eventId])
  const event = eventResult.rows[0]
  if (!event) throw new HttpError(404, 'Event not found')

  const registration = request.authUser
    ? await pool.query<{ status: string; attendance_status: string }>(`
        select r.status, r.attendance_status
        from public.rsvps r
        join public.members m on m.id = r.member_id
        where r.meeting_id = $1 and m.auth_user_id = $2
      `, [eventId, request.authUser.id])
    : null

  response.json({
    event: {
      id: event.id,
      title: event.title ?? `${event.book_title} discussion`,
      description: event.description,
      startsAt: event.starts_at.toISOString(),
      endsAt: event.ends_at.toISOString(),
      location: event.location,
      note: event.note,
      capacity: event.capacity,
      status: event.status,
      book: {
        id: event.book_id,
        slug: event.book_slug,
        title: event.book_title,
        author: event.book_author,
        genre: event.book_genre,
        rating: Number(event.book_rating),
        coverClass: event.cover_class,
        coverKicker: event.cover_kicker ?? undefined,
      },
      club: event.club_id ? {
        id: event.club_id,
        name: event.club_name,
        description: event.club_description,
      } : null,
      registration: registration?.rows[0] ?? null,
    },
  })
})
