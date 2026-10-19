import type {
  BookDetailsResponse,
  CommunityReview,
  EventDetails,
  ProfileEvent,
  ProfileResponse,
  ReadingStatus,
  SiteContent,
} from './types'
import { authRedirectUrl } from './config'
import { ensureMemberProfile, type MemberProfileRow } from './lib/member'
import { supabase } from './lib/supabase'

interface CatalogRow {
  id: string
  slug: string
  title: string
  author: string
  genre: string
  rating: number | string
  review_count: number
  cover_class: string
  cover_kicker: string | null
  cover_image_url: string | null
  featured: boolean
  description: string | null
  pages: number | null
  publication_year: number | null
  pull_quote: string | null
  display_order: number
  created_at: string
}

function relation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function mapBook(row: CatalogRow): BookDetailsResponse['book'] {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    genre: row.genre,
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    coverClass: row.cover_class,
    coverKicker: row.cover_kicker ?? undefined,
    coverImageUrl: row.cover_image_url ?? undefined,
    featured: row.featured,
    description: row.description ?? undefined,
    pages: row.pages ?? undefined,
    publicationYear: row.publication_year ?? undefined,
    pullQuote: row.pull_quote ?? undefined,
  }
}

async function signedInMember(): Promise<MemberProfileRow | null> {
  const { data, error } = await supabase.auth.getSession()
  check(error)
  return data.session ? ensureMemberProfile() : null
}

export async function getSiteContent(): Promise<SiteContent> {
  const [catalogResult, meetingsResult, reviewsResult] = await Promise.all([
    supabase.from('book_catalog').select('*')
      .order('featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase.from('meetings')
      .select('id, starts_at, ends_at, location, note, book:books!inner(title, author, slug)')
      .eq('status', 'scheduled')
      .order('starts_at', { ascending: true }),
    supabase.from('reviews')
      .select('id, display_name, initials, quote, rating, color, created_at, book:books!inner(title)')
      .eq('approved', true)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(12),
  ])
  check(catalogResult.error)
  check(meetingsResult.error)
  check(reviewsResult.error)

  const books = ((catalogResult.data ?? []) as CatalogRow[]).map(mapBook)
  const meetings = (meetingsResult.data ?? []) as Array<{
    id: string; starts_at: string; ends_at: string; location: string; note: string | null
    book: { title: string; author: string; slug: string } | Array<{ title: string; author: string; slug: string }>
  }>
  const now = Date.now()
  const meeting = meetings.find((item) => new Date(item.starts_at).getTime() >= now) ?? meetings.at(-1) ?? null
  const meetingBook = meeting ? relation(meeting.book) : null

  return {
    books: books.filter((book) => !book.featured),
    featuredBook: books.find((book) => book.featured) ?? null,
    nextMeeting: meeting && meetingBook ? {
      id: meeting.id,
      startsAt: meeting.starts_at,
      endsAt: meeting.ends_at,
      location: meeting.location,
      note: meeting.note,
      bookTitle: meetingBook.title,
      bookAuthor: meetingBook.author,
      bookSlug: meetingBook.slug,
    } : null,
    reviews: ((reviewsResult.data ?? []) as Array<{
      id: string; display_name: string; initials: string; quote: string; rating: number
      color: 'pink' | 'orange' | 'lime'; book: { title: string } | Array<{ title: string }>
    }>).flatMap((review) => {
      const book = relation(review.book)
      return book ? [{ id: review.id, name: review.display_name, initials: review.initials, book: book.title, quote: review.quote, rating: review.rating, color: review.color }] : []
    }),
  }
}

export async function joinClub(name: string, email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true, data: { full_name: name.trim() } },
  })
  check(error)
}

export async function getAccount() {
  const member = await ensureMemberProfile()
  return { member: { id: member.member_id, name: member.member_name, email: member.member_email } }
}

export async function rsvpToMeeting(meetingId: string) {
  const { data, error } = await supabase.rpc('register_for_meeting', { p_meeting_id: meetingId })
  check(error)
  const result = (data as Array<{ registration_status: 'attending' | 'waitlisted' }> | null)?.[0]
  if (!result) throw new Error('The registration could not be saved')
  return { status: result.registration_status }
}

export async function cancelMeetingRsvp(meetingId: string) {
  const { error } = await supabase.rpc('cancel_meeting_registration', { p_meeting_id: meetingId })
  check(error)
}

export async function searchBooks(filters: { search?: string; genre?: string; sort?: string }) {
  const { data, error } = await supabase.from('book_catalog').select('*').order('display_order').limit(100)
  check(error)
  const allBooks = ((data ?? []) as CatalogRow[]).map(mapBook)
  const genres = [...new Set(allBooks.map((book) => book.genre))].sort()
  const search = filters.search?.trim().toLocaleLowerCase() ?? ''
  const genre = filters.genre?.trim() ?? ''
  const books = allBooks
    .filter((book) => !search || `${book.title} ${book.author}`.toLocaleLowerCase().includes(search))
    .filter((book) => !genre || book.genre === genre)
    .sort((a, b) => {
      if (filters.sort === 'author') return a.author.localeCompare(b.author)
      if (filters.sort === 'rating') return b.rating - a.rating || a.title.localeCompare(b.title)
      return a.title.localeCompare(b.title)
    })
  return { books, genres }
}

export async function getBookDetails(slug: string): Promise<BookDetailsResponse> {
  const bookResult = await supabase.from('book_catalog').select('*').eq('slug', slug).maybeSingle()
  check(bookResult.error)
  if (!bookResult.data) throw new Error('Book not found')
  const book = mapBook(bookResult.data as CatalogRow)
  const member = await signedInMember()

  const [reviewsResult, clubsResult, shelfResult] = await Promise.all([
    supabase.from('reviews')
      .select('id, member_id, display_name, initials, quote, rating, approved, created_at')
      .eq('book_id', book.id).order('created_at', { ascending: false }),
    supabase.from('book_club_selections')
      .select('id, status, club:book_clubs!inner(id, slug, name, description), meeting:meetings(id, title, starts_at, location)')
      .eq('book_id', book.id).in('status', ['planned', 'current']).order('starts_on'),
    member
      ? supabase.from('reading_lists').select('status').eq('member_id', member.member_id).eq('book_id', book.id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  check(reviewsResult.error)
  check(clubsResult.error)
  check(shelfResult.error)

  const reviews: CommunityReview[] = ((reviewsResult.data ?? []) as Array<{
    id: string; member_id: string | null; display_name: string; initials: string; quote: string
    rating: number; approved: boolean; created_at: string
  }>).map((review) => ({
    id: review.id,
    memberId: review.member_id,
    reviewerName: review.display_name,
    initials: review.initials,
    avatarUrl: null,
    text: review.quote,
    rating: review.rating,
    approved: review.approved,
    createdAt: review.created_at,
    isOwn: review.member_id === member?.member_id,
  }))
  const ownReview = reviews.find((review) => review.isOwn)

  return {
    book,
    reviews,
    clubs: ((clubsResult.data ?? []) as Array<{
      id: string; status: 'planned' | 'current'
      club: { id: string; slug: string; name: string; description: string } | Array<{ id: string; slug: string; name: string; description: string }>
      meeting: { id: string; title: string | null; starts_at: string | null; location: string | null } | Array<{ id: string; title: string | null; starts_at: string | null; location: string | null }> | null
    }>).flatMap((selection) => {
      const club = relation(selection.club)
      const meeting = relation(selection.meeting)
      return club ? [{
        id: club.id,
        slug: club.slug,
        name: club.name,
        description: club.description,
        selectionStatus: selection.status,
        nextEvent: meeting ? { id: meeting.id, title: meeting.title, startsAt: meeting.starts_at, location: meeting.location } : null,
      }] : []
    }),
    viewer: {
      readingStatus: (shelfResult.data?.status as ReadingStatus | undefined) ?? null,
      reviewId: ownReview?.id ?? null,
    },
  }
}

export async function setReadingStatus(bookId: string, status: ReadingStatus) {
  const member = await ensureMemberProfile()
  const existing = await supabase.from('reading_lists').select('started_at')
    .eq('member_id', member.member_id).eq('book_id', bookId).maybeSingle()
  check(existing.error)
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase.from('reading_lists').upsert({
    member_id: member.member_id,
    book_id: bookId,
    status,
    started_at: status === 'want_to_read' ? null : existing.data?.started_at ?? today,
    finished_at: status === 'read' ? today : null,
  }, { onConflict: 'member_id,book_id' }).select('status').single()
  check(error)
  if (!data) throw new Error('Reading status was not saved')
  return { status: data.status as ReadingStatus }
}

export async function removeReadingStatus(bookId: string) {
  const member = await ensureMemberProfile()
  const { error } = await supabase.from('reading_lists').delete()
    .eq('member_id', member.member_id).eq('book_id', bookId)
  check(error)
}

export async function getProfile(): Promise<ProfileResponse> {
  const member = await ensureMemberProfile()
  const [eventsResult, shelfResult, reviewsResult] = await Promise.all([
    supabase.from('rsvps')
      .select('status, attendance_status, meeting:meetings!inner(id, title, starts_at, ends_at, location, note, book:books!inner(id, slug, title, author, cover_class))')
      .eq('member_id', member.member_id).neq('status', 'cancelled').order('created_at'),
    supabase.from('reading_lists')
      .select('id, status, updated_at, book:books!inner(id, slug, title, author, genre, rating, cover_class, cover_kicker)')
      .eq('member_id', member.member_id).order('updated_at', { ascending: false }),
    supabase.from('reviews')
      .select('id, quote, rating, approved, created_at, book:books!inner(id, slug, title, author, cover_class)')
      .eq('member_id', member.member_id).order('created_at', { ascending: false }),
  ])
  check(eventsResult.error)
  check(shelfResult.error)
  check(reviewsResult.error)

  type EventBook = { id: string; slug: string; title: string; author: string; cover_class: string }
  type MeetingRow = { id: string; title: string | null; starts_at: string; ends_at: string; location: string; note: string | null; book: EventBook | EventBook[] }
  const events: ProfileEvent[] = ((eventsResult.data ?? []) as Array<{
    status: 'attending' | 'waitlisted'; attendance_status: 'registered' | 'confirmed' | 'no_show'; meeting: MeetingRow | MeetingRow[]
  }>).flatMap((registration) => {
    const meeting = relation(registration.meeting)
    const book = meeting ? relation(meeting.book) : null
    return meeting && book ? [{
      id: meeting.id,
      title: meeting.title ?? `${book.title} discussion`,
      startsAt: meeting.starts_at,
      endsAt: meeting.ends_at,
      location: meeting.location,
      note: meeting.note,
      registrationStatus: registration.status,
      attendanceStatus: registration.attendance_status,
      book: { id: book.id, slug: book.slug, title: book.title, author: book.author, coverClass: book.cover_class },
    }] : []
  })
  const now = Date.now()

  const reviews = ((reviewsResult.data ?? []) as Array<{
    id: string; quote: string; rating: number; approved: boolean; created_at: string; book: EventBook | EventBook[]
  }>).flatMap((review) => {
    const book = relation(review.book)
    return book ? [{
      id: review.id,
      text: review.quote,
      rating: review.rating,
      approved: review.approved,
      createdAt: review.created_at,
      book: { id: book.id, slug: book.slug, title: book.title, author: book.author, coverClass: book.cover_class },
    }] : []
  })

  type ShelfBook = EventBook & { genre: string; rating: number | string; cover_kicker: string | null }
  return {
    profile: {
      id: member.member_id,
      username: member.username,
      displayName: member.display_name,
      email: member.member_email,
      bio: member.bio ?? '',
      avatarUrl: member.avatar_url ?? '',
      memberSince: member.created_at,
    },
    stats: {
      booksRead: ((shelfResult.data ?? []) as Array<{ status: string }>).filter((item) => item.status === 'read').length,
      eventsAttended: events.filter((event) => event.attendanceStatus === 'confirmed').length,
      reviewsWritten: reviews.length,
    },
    upcomingEvents: events.filter((event) => new Date(event.endsAt).getTime() >= now),
    attendedEvents: events.filter((event) => event.attendanceStatus === 'confirmed')
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()),
    bookshelf: ((shelfResult.data ?? []) as Array<{ id: string; status: ReadingStatus; updated_at: string; book: ShelfBook | ShelfBook[] }>).flatMap((item) => {
      const book = relation(item.book)
      return book ? [{
        id: item.id,
        status: item.status,
        updatedAt: item.updated_at,
        book: {
          id: book.id,
          slug: book.slug,
          title: book.title,
          author: book.author,
          genre: book.genre,
          rating: Number(book.rating),
          coverClass: book.cover_class,
          coverKicker: book.cover_kicker ?? undefined,
        },
      }] : []
    }),
    reviews,
  }
}

export async function updateProfile(input: { username: string; displayName: string; bio: string | null; avatarUrl: string | null }) {
  const member = await ensureMemberProfile()
  const { data, error } = await supabase.from('members').update({
    username: input.username.trim().toLowerCase(),
    display_name: input.displayName.trim(),
    bio: input.bio?.trim() || null,
    avatar_url: input.avatarUrl?.trim() || null,
  }).eq('id', member.member_id).select('username, display_name, bio, avatar_url').single()
  check(error)
  if (!data) throw new Error('Profile was not updated')
  return { profile: { username: data.username, displayName: data.display_name, bio: data.bio ?? '', avatarUrl: data.avatar_url ?? '' } }
}

export async function createReview(bookId: string, rating: number, text: string) {
  const member = await ensureMemberProfile()
  const initials = member.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 4).toUpperCase() || 'R'
  const { data, error } = await supabase.from('reviews').insert({
    member_id: member.member_id,
    book_id: bookId,
    display_name: member.display_name,
    initials,
    quote: text.trim(),
    rating,
    color: 'pink',
    approved: false,
  }).select('id').single()
  check(error)
  if (!data) throw new Error('Review was not created')
  return { review: { id: data.id } }
}

export async function updateReview(reviewId: string, rating: number, text: string) {
  const { data, error } = await supabase.from('reviews')
    .update({ quote: text.trim(), rating, approved: false }).eq('id', reviewId).select('id').maybeSingle()
  check(error)
  if (!data) throw new Error('Review not found')
  return { review: { id: data.id } }
}

export async function deleteReview(reviewId: string) {
  const { data, error } = await supabase.from('reviews').delete().eq('id', reviewId).select('id').maybeSingle()
  check(error)
  if (!data) throw new Error('Review not found')
}

export async function getEvent(eventId: string): Promise<{ event: EventDetails }> {
  const eventResult = await supabase.from('meetings')
    .select('id, title, description, starts_at, ends_at, location, note, capacity, status, book:books!inner(id, slug, title, author, genre, rating, cover_class, cover_kicker), club:book_clubs(id, name, description)')
    .eq('id', eventId).in('status', ['scheduled', 'completed']).maybeSingle()
  check(eventResult.error)
  if (!eventResult.data) throw new Error('Event not found')

  const member = await signedInMember()
  const registrationResult = member
    ? await supabase.from('rsvps').select('status, attendance_status')
      .eq('member_id', member.member_id).eq('meeting_id', eventId).maybeSingle()
    : { data: null, error: null }
  check(registrationResult.error)

  type EventBook = { id: string; slug: string; title: string; author: string; genre: string; rating: number | string; cover_class: string; cover_kicker: string | null }
  const row = eventResult.data as {
    id: string; title: string | null; description: string | null; starts_at: string; ends_at: string
    location: string; note: string | null; capacity: number | null; status: 'scheduled' | 'completed'
    book: EventBook | EventBook[]
    club: { id: string; name: string; description: string } | Array<{ id: string; name: string; description: string }> | null
  }
  const book = relation(row.book)
  const club = relation(row.club)
  if (!book) throw new Error('The event book could not be loaded')

  return {
    event: {
      id: row.id,
      title: row.title ?? `${book.title} discussion`,
      description: row.description,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      location: row.location,
      note: row.note,
      capacity: row.capacity,
      status: row.status,
      book: { id: book.id, slug: book.slug, title: book.title, author: book.author, genre: book.genre, rating: Number(book.rating), coverClass: book.cover_class, coverKicker: book.cover_kicker ?? undefined },
      club,
      registration: registrationResult.data ? {
        status: registrationResult.data.status as 'attending' | 'waitlisted' | 'cancelled',
        attendance_status: registrationResult.data.attendance_status,
      } : null,
    },
  }
}
