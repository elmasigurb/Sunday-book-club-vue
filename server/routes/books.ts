import { Router } from 'express'
import { z } from 'zod'
import { authenticatedUser, optionalAuth, requireAuth } from '../auth.js'
import { pool } from '../db.js'
import { HttpError } from '../errors.js'
import { ensureMember } from '../member-profile.js'

export const booksRouter = Router()

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional().default(''),
  genre: z.string().trim().max(80).optional().default(''),
  sort: z.enum(['title', 'author', 'rating']).optional().default('title'),
})
const slugSchema = z.object({ slug: z.string().min(1).max(160) })
const bookIdSchema = z.object({ bookId: z.string().uuid() })
const readingStatusSchema = z.object({
  status: z.enum(['want_to_read', 'currently_reading', 'read']),
})
const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  text: z.string().trim().min(10).max(1000),
})

const sortSql = {
  title: 'b.title asc, b.author asc',
  author: 'b.author asc, b.title asc',
  rating: 'community_rating desc, b.title asc',
} as const

booksRouter.get('/', async (request, response) => {
  const query = listQuerySchema.parse(request.query)
  const search = query.search ? `%${query.search}%` : null
  const genre = query.genre || null

  const [booksResult, genresResult] = await Promise.all([
    pool.query<{
      id: string
      slug: string
      title: string
      author: string
      genre: string
      community_rating: string
      review_count: string
      cover_class: string
      cover_kicker: string | null
      cover_image_url: string | null
      publication_year: number | null
    }>(`
      select b.id, b.slug, b.title, b.author, b.genre, b.cover_class,
             b.cover_kicker, b.cover_image_url, b.publication_year,
             coalesce(round(avg(r.rating)::numeric, 1), b.rating) as community_rating,
             count(r.id)::text as review_count
      from public.books b
      left join public.reviews r on r.book_id = b.id and r.approved = true
      where b.published = true
        and ($1::text is null or b.title ilike $1 or b.author ilike $1)
        and ($2::text is null or b.genre = $2)
      group by b.id
      order by ${sortSql[query.sort]}
      limit 100
    `, [search, genre]),
    pool.query<{ genre: string }>(`
      select distinct genre from public.books where published = true order by genre
    `),
  ])

  response.json({
    books: booksResult.rows.map((book) => ({
      id: book.id,
      slug: book.slug,
      title: book.title,
      author: book.author,
      genre: book.genre,
      rating: Number(book.community_rating),
      reviewCount: Number(book.review_count),
      coverClass: book.cover_class,
      coverKicker: book.cover_kicker ?? undefined,
      coverImageUrl: book.cover_image_url ?? undefined,
      publicationYear: book.publication_year ?? undefined,
    })),
    genres: genresResult.rows.map(({ genre: item }) => item),
  })
})

booksRouter.get('/:slug', optionalAuth, async (request, response) => {
  const { slug } = slugSchema.parse(request.params)
  const bookResult = await pool.query<{
    id: string
    slug: string
    title: string
    author: string
    genre: string
    community_rating: string
    review_count: string
    cover_class: string
    cover_kicker: string | null
    cover_image_url: string | null
    description: string | null
    pages: number | null
    publication_year: number | null
    pull_quote: string | null
  }>(`
    select b.id, b.slug, b.title, b.author, b.genre, b.cover_class,
           b.cover_kicker, b.cover_image_url, b.description, b.pages,
           b.publication_year, b.pull_quote,
           coalesce(round(avg(r.rating)::numeric, 1), b.rating) as community_rating,
           count(r.id)::text as review_count
    from public.books b
    left join public.reviews r on r.book_id = b.id and r.approved = true
    where b.slug = $1 and b.published = true
    group by b.id
  `, [slug])
  const book = bookResult.rows[0]
  if (!book) throw new HttpError(404, 'Book not found')

  const [reviewsResult, clubsResult, viewerResult] = await Promise.all([
    pool.query<{
      id: string
      member_id: string | null
      reviewer_name: string
      initials: string
      avatar_url: string | null
      quote: string
      rating: number
      created_at: Date
    }>(`
      select r.id, r.member_id,
             coalesce(m.display_name, r.display_name) as reviewer_name,
             r.initials, m.avatar_url, r.quote, r.rating, r.created_at
      from public.reviews r
      left join public.members m on m.id = r.member_id
      where r.book_id = $1 and r.approved = true
      order by r.created_at desc
    `, [book.id]),
    pool.query<{
      id: string
      slug: string
      name: string
      description: string
      selection_status: string
      meeting_id: string | null
      meeting_title: string | null
      starts_at: Date | null
      location: string | null
    }>(`
      select c.id, c.slug, c.name, c.description,
             s.status as selection_status, m.id as meeting_id,
             m.title as meeting_title, m.starts_at, m.location
      from public.book_club_selections s
      join public.book_clubs c on c.id = s.club_id and c.active = true
      left join public.meetings m on m.id = s.meeting_id
      where s.book_id = $1 and s.status in ('planned', 'current')
      order by m.starts_at asc nulls last
    `, [book.id]),
    request.authUser
      ? pool.query<{
          reading_status: 'want_to_read' | 'currently_reading' | 'read' | null
          review_id: string | null
        }>(`
          select rl.status as reading_status, own_review.id as review_id
          from public.members member
          left join public.reading_lists rl
            on rl.member_id = member.id and rl.book_id = $2
          left join public.reviews own_review
            on own_review.member_id = member.id and own_review.book_id = $2
          where member.auth_user_id = $1
        `, [request.authUser.id, book.id])
      : Promise.resolve({ rows: [] }),
  ])

  const viewer = viewerResult.rows[0]
  response.json({
    book: {
      id: book.id,
      slug: book.slug,
      title: book.title,
      author: book.author,
      genre: book.genre,
      rating: Number(book.community_rating),
      reviewCount: Number(book.review_count),
      coverClass: book.cover_class,
      coverKicker: book.cover_kicker ?? undefined,
      coverImageUrl: book.cover_image_url ?? undefined,
      description: book.description ?? undefined,
      pages: book.pages ?? undefined,
      publicationYear: book.publication_year ?? undefined,
      pullQuote: book.pull_quote ?? undefined,
    },
    reviews: reviewsResult.rows.map((review) => ({
      id: review.id,
      memberId: review.member_id,
      reviewerName: review.reviewer_name,
      initials: review.initials,
      avatarUrl: review.avatar_url,
      text: review.quote,
      rating: review.rating,
      createdAt: review.created_at.toISOString(),
      isOwn: Boolean(request.authUser && review.member_id && review.id === viewer?.review_id),
    })),
    clubs: clubsResult.rows.map((club) => ({
      id: club.id,
      slug: club.slug,
      name: club.name,
      description: club.description,
      selectionStatus: club.selection_status,
      nextEvent: club.meeting_id ? {
        id: club.meeting_id,
        title: club.meeting_title,
        startsAt: club.starts_at?.toISOString() ?? null,
        location: club.location,
      } : null,
    })),
    viewer: {
      readingStatus: viewer?.reading_status ?? null,
      reviewId: viewer?.review_id ?? null,
    },
  })
})

booksRouter.put('/:bookId/reading-status', requireAuth, async (request, response) => {
  const { bookId } = bookIdSchema.parse(request.params)
  const { status } = readingStatusSchema.parse(request.body)
  const user = authenticatedUser(request)
  const client = await pool.connect()
  try {
    await client.query('begin')
    const member = await ensureMember(client, user)
    const result = await client.query<{ status: string }>(`
      insert into public.reading_lists (member_id, book_id, status, started_at, finished_at)
      values ($1, $2, $3,
        case when $3 in ('currently_reading', 'read') then current_date else null end,
        case when $3 = 'read' then current_date else null end)
      on conflict (member_id, book_id) do update
        set status = excluded.status,
            started_at = case
              when excluded.status in ('currently_reading', 'read')
                then coalesce(reading_lists.started_at, current_date)
              else null
            end,
            finished_at = case when excluded.status = 'read' then current_date else null end
      returning status
    `, [member.id, bookId, status])
    await client.query('commit')
    response.json({ status: result.rows[0]!.status })
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
})

booksRouter.delete('/:bookId/reading-status', requireAuth, async (request, response) => {
  const { bookId } = bookIdSchema.parse(request.params)
  const user = authenticatedUser(request)
  await pool.query(`
    delete from public.reading_lists rl
    using public.members m
    where rl.member_id = m.id and rl.book_id = $1 and m.auth_user_id = $2
  `, [bookId, user.id])
  response.status(204).send()
})

booksRouter.post('/:bookId/reviews', requireAuth, async (request, response) => {
  const { bookId } = bookIdSchema.parse(request.params)
  const input = reviewSchema.parse(request.body)
  const user = authenticatedUser(request)
  const client = await pool.connect()

  try {
    await client.query('begin')
    const member = await ensureMember(client, user)
    const name = member.display_name ?? member.name
    const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 4).toUpperCase()
    const result = await client.query<{
      id: string
      quote: string
      rating: number
      created_at: Date
    }>(`
      insert into public.reviews
        (member_id, book_id, display_name, initials, quote, rating, color, approved)
      values ($1, $2, $3, $4, $5, $6, 'pink', false)
      returning id, quote, rating, created_at
    `, [member.id, bookId, name, initials || 'R', input.text, input.rating])
    await client.query('commit')
    response.status(201).json({
      review: {
        id: result.rows[0]!.id,
        text: result.rows[0]!.quote,
        rating: result.rows[0]!.rating,
        createdAt: result.rows[0]!.created_at.toISOString(),
      },
    })
  } catch (error) {
    await client.query('rollback')
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') {
      throw new HttpError(409, 'You have already reviewed this book')
    }
    throw error
  } finally {
    client.release()
  }
})
