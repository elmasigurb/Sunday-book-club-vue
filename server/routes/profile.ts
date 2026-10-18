import { Router } from 'express'
import { z } from 'zod'
import { authenticatedUser, requireAuth } from '../auth.js'
import { pool } from '../db.js'
import { HttpError } from '../errors.js'
import { ensureMember } from '../member-profile.js'

export const profileRouter = Router()

const profileSchema = z.object({
  username: z.string().trim().min(3).max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i),
  displayName: z.string().trim().min(2).max(100),
  bio: z.string().trim().max(500).nullable(),
  avatarUrl: z.union([
    z.string().trim().url().max(1000).refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Use an HTTP or HTTPS image URL'),
    z.literal(''),
    z.null(),
  ]).optional(),
})

profileRouter.get('/', requireAuth, async (request, response) => {
  const user = authenticatedUser(request)
  const client = await pool.connect()
  try {
    await client.query('begin')
    const member = await ensureMember(client, user)
    const [stats, events, bookshelf, reviews] = await Promise.all([
      client.query<{
        books_read: string
        events_attended: string
        reviews_written: string
      }>(`
        select
          (select count(*) from public.reading_lists where member_id = $1 and status = 'read')::text as books_read,
          (select count(*) from public.rsvps where member_id = $1 and attendance_status = 'confirmed')::text as events_attended,
          (select count(*) from public.reviews where member_id = $1)::text as reviews_written
      `, [member.id]),
      client.query<{
        id: string
        title: string | null
        starts_at: Date
        ends_at: Date
        location: string
        note: string | null
        registration_status: string
        attendance_status: string
        book_id: string
        book_slug: string
        book_title: string
        book_author: string
        cover_class: string
      }>(`
        select m.id, m.title, m.starts_at, m.ends_at, m.location, m.note,
               r.status as registration_status, r.attendance_status,
               b.id as book_id, b.slug as book_slug, b.title as book_title,
               b.author as book_author, b.cover_class
        from public.rsvps r
        join public.meetings m on m.id = r.meeting_id
        join public.books b on b.id = m.book_id
        where r.member_id = $1 and r.status <> 'cancelled'
        order by m.starts_at asc
      `, [member.id]),
      client.query<{
        id: string
        status: 'want_to_read' | 'currently_reading' | 'read'
        created_at: Date
        updated_at: Date
        book_id: string
        slug: string
        title: string
        author: string
        genre: string
        rating: string
        cover_class: string
        cover_kicker: string | null
      }>(`
        select rl.id, rl.status, rl.created_at, rl.updated_at,
               b.id as book_id, b.slug, b.title, b.author, b.genre, b.rating,
               b.cover_class, b.cover_kicker
        from public.reading_lists rl
        join public.books b on b.id = rl.book_id
        where rl.member_id = $1 and b.published = true
        order by
          case rl.status when 'currently_reading' then 1 when 'want_to_read' then 2 else 3 end,
          rl.updated_at desc
      `, [member.id]),
      client.query<{
        id: string
        quote: string
        rating: number
        created_at: Date
        book_id: string
        slug: string
        title: string
        author: string
        cover_class: string
      }>(`
        select r.id, r.quote, r.rating, r.created_at,
               b.id as book_id, b.slug, b.title, b.author, b.cover_class
        from public.reviews r
        join public.books b on b.id = r.book_id
        where r.member_id = $1
        order by r.created_at desc
      `, [member.id]),
    ])
    await client.query('commit')

    const mapEvent = (event: typeof events.rows[number]) => ({
      id: event.id,
      title: event.title ?? `${event.book_title} discussion`,
      startsAt: event.starts_at.toISOString(),
      endsAt: event.ends_at.toISOString(),
      location: event.location,
      note: event.note,
      registrationStatus: event.registration_status,
      attendanceStatus: event.attendance_status,
      book: {
        id: event.book_id,
        slug: event.book_slug,
        title: event.book_title,
        author: event.book_author,
        coverClass: event.cover_class,
      },
    })
    const now = Date.now()

    response.json({
      profile: {
        id: member.id,
        username: member.username,
        displayName: member.display_name ?? member.name,
        email: member.email,
        bio: member.bio ?? '',
        avatarUrl: member.avatar_url ?? '',
        memberSince: member.created_at?.toISOString(),
      },
      stats: {
        booksRead: Number(stats.rows[0]?.books_read ?? 0),
        eventsAttended: Number(stats.rows[0]?.events_attended ?? 0),
        reviewsWritten: Number(stats.rows[0]?.reviews_written ?? 0),
      },
      upcomingEvents: events.rows
        .filter((event) => event.ends_at.getTime() >= now)
        .map(mapEvent),
      attendedEvents: events.rows
        .filter((event) => event.attendance_status === 'confirmed')
        .sort((a, b) => b.starts_at.getTime() - a.starts_at.getTime())
        .map(mapEvent),
      bookshelf: bookshelf.rows.map((item) => ({
        id: item.id,
        status: item.status,
        updatedAt: item.updated_at.toISOString(),
        book: {
          id: item.book_id,
          slug: item.slug,
          title: item.title,
          author: item.author,
          genre: item.genre,
          rating: Number(item.rating),
          coverClass: item.cover_class,
          coverKicker: item.cover_kicker ?? undefined,
        },
      })),
      reviews: reviews.rows.map((review) => ({
        id: review.id,
        text: review.quote,
        rating: review.rating,
        createdAt: review.created_at.toISOString(),
        book: {
          id: review.book_id,
          slug: review.slug,
          title: review.title,
          author: review.author,
          coverClass: review.cover_class,
        },
      })),
    })
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})

profileRouter.patch('/', requireAuth, async (request, response) => {
  const input = profileSchema.parse(request.body)
  const user = authenticatedUser(request)
  const client = await pool.connect()
  try {
    await client.query('begin')
    const member = await ensureMember(client, user)
    const result = await client.query<{
      username: string
      display_name: string
      bio: string | null
      avatar_url: string | null
    }>(`
      update public.members
      set username = lower($2), display_name = $3, bio = $4, avatar_url = $5
      where id = $1
      returning username, display_name, bio, avatar_url
    `, [member.id, input.username, input.displayName, input.bio || null, input.avatarUrl || null])
    await client.query('commit')
    response.json({
      profile: {
        username: result.rows[0]!.username,
        displayName: result.rows[0]!.display_name,
        bio: result.rows[0]!.bio ?? '',
        avatarUrl: result.rows[0]!.avatar_url ?? '',
      },
    })
  } catch (error) {
    await client.query('rollback')
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      throw new HttpError(409, 'That username is already taken')
    }
    throw error
  } finally {
    client.release()
  }
})
