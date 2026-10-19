export type ReadingStatus = 'want_to_read' | 'currently_reading' | 'read'

export interface Book {
  id?: string
  slug?: string
  title: string
  author: string
  genre: string
  rating: number
  reviewCount?: number
  coverClass: string
  coverKicker?: string
  coverImageUrl?: string
  featured?: boolean
  description?: string
  pages?: number
  publicationYear?: number
  pullQuote?: string
}

export interface Review {
  id?: string
  name: string
  initials: string
  book: string
  quote: string
  rating: number
  color: 'pink' | 'orange' | 'lime'
}

export interface CommunityReview {
  id: string
  memberId: string | null
  reviewerName: string
  initials: string
  avatarUrl: string | null
  text: string
  rating: number
  approved: boolean
  createdAt: string
  isOwn: boolean
}

export interface Meeting {
  id: string
  startsAt: string
  endsAt: string
  location: string
  note: string | null
  bookTitle: string
  bookAuthor: string
  bookSlug?: string
}

export interface ClubSelection {
  id: string
  slug: string
  name: string
  description: string
  selectionStatus: 'planned' | 'current'
  nextEvent: {
    id: string
    title: string | null
    startsAt: string | null
    location: string | null
  } | null
}

export interface BookDetailsResponse {
  book: Book & { id: string; slug: string }
  reviews: CommunityReview[]
  clubs: ClubSelection[]
  viewer: { readingStatus: ReadingStatus | null; reviewId: string | null }
}

export interface ProfileEvent {
  id: string
  title: string
  startsAt: string
  endsAt: string
  location: string
  note: string | null
  registrationStatus: 'attending' | 'waitlisted'
  attendanceStatus: 'registered' | 'confirmed' | 'no_show'
  book: Pick<Book, 'id' | 'slug' | 'title' | 'author' | 'coverClass'>
}

export interface BookshelfItem {
  id: string
  status: ReadingStatus
  updatedAt: string
  book: Book & { id: string; slug: string }
}

export interface ProfileReview {
  id: string
  text: string
  rating: number
  approved: boolean
  createdAt: string
  book: Pick<Book, 'id' | 'slug' | 'title' | 'author' | 'coverClass'>
}

export interface ProfileResponse {
  profile: {
    id: string
    username: string
    displayName: string
    email: string
    bio: string
    avatarUrl: string
    memberSince: string
  }
  stats: { booksRead: number; eventsAttended: number; reviewsWritten: number }
  upcomingEvents: ProfileEvent[]
  attendedEvents: ProfileEvent[]
  bookshelf: BookshelfItem[]
  reviews: ProfileReview[]
}

export interface EventDetails {
  id: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string
  location: string
  note: string | null
  capacity: number | null
  status: 'scheduled' | 'completed'
  book: Book & { id: string; slug: string }
  club: { id: string; name: string; description: string } | null
  registration: { status: 'attending' | 'waitlisted' | 'cancelled'; attendance_status: string } | null
}

export interface SiteContent {
  books: Book[]
  featuredBook: Book | null
  nextMeeting: Meeting | null
  reviews: Review[]
}
