import { Router } from 'express'
import { pool } from '../db.js'

export const contentRouter = Router()

contentRouter.get('/', async (_request, response) => {
  const [booksResult, meetingResult, reviewsResult] = await Promise.all([
    pool.query<{
      id: string
      slug: string
      title: string
      author: string
      genre: string
      rating: string
      cover_class: string
      cover_kicker: string | null
      featured: boolean
      description: string | null
      pages: number | null
      publication_year: number | null
      pull_quote: string | null
    }>(`
      select id, slug, title, author, genre, rating, cover_class, cover_kicker,
             featured, description, pages, publication_year, pull_quote
      from public.books
      where published = true
      order by featured desc, display_order asc, created_at desc
    `),
    pool.query<{
      id: string
      starts_at: Date
      ends_at: Date
      location: string
      note: string | null
      book_title: string
      book_author: string
      book_slug: string
    }>(`
      select m.id, m.starts_at, m.ends_at, m.location, m.note,
             b.title as book_title, b.author as book_author, b.slug as book_slug
      from public.meetings m
      join public.books b on b.id = m.book_id
      where m.status = 'scheduled'
      order by (m.starts_at >= now()) desc,
               case when m.starts_at >= now() then m.starts_at end asc,
               m.starts_at desc
      limit 1
    `),
    pool.query<{
      id: string
      display_name: string
      initials: string
      book_title: string
      quote: string
      rating: number
      color: 'pink' | 'orange' | 'lime'
    }>(`
      select r.id, r.display_name, r.initials, b.title as book_title,
             r.quote, r.rating, r.color
      from public.reviews r
      join public.books b on b.id = r.book_id
      where r.approved = true
      order by r.display_order asc, r.created_at desc
      limit 12
    `),
  ])

  const books = booksResult.rows.map((book) => ({
    id: book.id,
    slug: book.slug,
    title: book.title,
    author: book.author,
    genre: book.genre,
    rating: Number(book.rating),
    coverClass: book.cover_class,
    coverKicker: book.cover_kicker ?? undefined,
    featured: book.featured,
    description: book.description ?? undefined,
    pages: book.pages ?? undefined,
    publicationYear: book.publication_year ?? undefined,
    pullQuote: book.pull_quote ?? undefined,
  }))

  const meeting = meetingResult.rows[0]

  response.json({
    books: books.filter((book) => !book.featured),
    featuredBook: books.find((book) => book.featured) ?? null,
    nextMeeting: meeting
      ? {
          id: meeting.id,
          startsAt: meeting.starts_at.toISOString(),
          endsAt: meeting.ends_at.toISOString(),
          location: meeting.location,
          note: meeting.note,
          bookTitle: meeting.book_title,
          bookAuthor: meeting.book_author,
          bookSlug: meeting.book_slug,
        }
      : null,
    reviews: reviewsResult.rows.map((review) => ({
      id: review.id,
      name: review.display_name,
      initials: review.initials,
      book: review.book_title,
      quote: review.quote,
      rating: review.rating,
      color: review.color,
    })),
  })
})
