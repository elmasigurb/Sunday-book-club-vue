import type { BookDetailsResponse, CommunityReview, EventDetails, SiteContent } from './types'

export const showcaseBooks: BookDetailsResponse['book'][] = [
  {
    id: 'book-sunday-chapter',
    slug: 'the-sunday-chapter',
    title: 'The Sunday Chapter',
    author: 'June Harper',
    genre: 'Literary fiction',
    rating: 5,
    reviewCount: 0,
    coverClass: 'cover-featured',
    coverKicker: 'A Novel',
    featured: true,
    description: 'When three strangers inherit a tiny bookshop on the edge of Reykjavík, they discover a pencilled note inside every book—and a story that might connect them all.',
    pages: 304,
    publicationYear: 2026,
    pullQuote: 'Warm, strange and impossible to put down.',
  },
  {
    id: 'book-apricot-skies',
    slug: 'apricot-skies',
    title: 'Apricot Skies',
    author: 'Mara Vale',
    genre: 'Romance',
    rating: 4.8,
    reviewCount: 1,
    coverClass: 'cover-apricot',
    coverKicker: 'A love story',
    description: 'Two old friends meet again during one luminous summer and must decide whether timing is fate or simply another story we tell ourselves.',
    publicationYear: 2024,
  },
  {
    id: 'book-green-room',
    slug: 'the-green-room',
    title: 'The Green Room',
    author: 'Elliot Pine',
    genre: 'Literary fiction',
    rating: 4.6,
    reviewCount: 1,
    coverClass: 'cover-green',
    description: 'Behind the velvet curtain of a fading theatre, five performers rehearse a final production while the lives they avoid begin to take centre stage.',
    publicationYear: 2023,
  },
  {
    id: 'book-salt-honey',
    slug: 'salt-and-honey',
    title: 'Salt & Honey',
    author: 'Nora Bell',
    genre: 'Memoir',
    rating: 4.9,
    reviewCount: 1,
    coverClass: 'cover-salt',
    coverKicker: 'A memoir',
    description: 'A tender memoir of kitchens, coastlines, family recipes, and the complicated inheritance held inside the food we remember.',
    publicationYear: 2025,
  },
  {
    id: 'book-after-sun',
    slug: 'after-the-sun',
    title: 'After the Sun',
    author: 'Leonie Hart',
    genre: 'Short stories',
    rating: 4.7,
    reviewCount: 0,
    coverClass: 'cover-sun',
    coverKicker: 'Stories',
    description: 'Stories of small endings and unexpected beginnings, following people who step into the long evening light and return subtly changed.',
    publicationYear: 2022,
  },
]

const showcaseReviews: CommunityReview[] = [
  { id: 'review-anna', memberId: null, reviewerName: 'Anna', initials: 'AM', avatarUrl: null, text: 'I joined for the books and stayed for the people—and the truly excellent Sunday cake.', rating: 5, createdAt: '2026-09-12T12:00:00Z', isOwn: false },
  { id: 'review-sara', memberId: null, reviewerName: 'Sara', initials: 'SK', avatarUrl: null, text: 'My favourite Sunday of every month. The kind of conversation that follows you home.', rating: 5, createdAt: '2026-09-20T12:00:00Z', isOwn: false },
  { id: 'review-elin', memberId: null, reviewerName: 'Elín', initials: 'EJ', avatarUrl: null, text: 'It has completely changed how I read. Every book feels bigger when we unpack it together.', rating: 5, createdAt: '2026-10-01T12:00:00Z', isOwn: false },
]

export const showcaseEvent: EventDetails = {
  id: 'meeting-november-2026',
  title: 'Sunday Book Club Meeting',
  description: 'A thoughtful Sunday conversation around The Sunday Chapter.',
  startsAt: '2026-11-15T14:00:00Z',
  endsAt: '2026-11-15T16:00:00Z',
  location: 'Sunday Studio, Reykjavík',
  note: 'Coffee, cake & good conversation included',
  capacity: 40,
  status: 'scheduled',
  book: showcaseBooks[0],
  club: {
    id: 'club-sunday',
    name: 'Sunday Book Club',
    description: 'A warm Reykjavík reading community for thoughtful books, generous conversation, coffee, and cake.',
  },
  registration: null,
}

export const showcaseContent: SiteContent = {
  books: showcaseBooks.filter((book) => !book.featured),
  featuredBook: showcaseBooks[0],
  nextMeeting: {
    id: showcaseEvent.id,
    startsAt: showcaseEvent.startsAt,
    endsAt: showcaseEvent.endsAt,
    location: showcaseEvent.location,
    note: showcaseEvent.note,
    bookTitle: showcaseEvent.book.title,
    bookAuthor: showcaseEvent.book.author,
    bookSlug: showcaseEvent.book.slug,
  },
  reviews: [
    { id: 'review-anna', name: 'Anna', initials: 'AM', book: 'Apricot Skies', quote: showcaseReviews[0].text, rating: 5, color: 'pink' },
    { id: 'review-sara', name: 'Sara', initials: 'SK', book: 'The Green Room', quote: showcaseReviews[1].text, rating: 5, color: 'lime' },
    { id: 'review-elin', name: 'Elín', initials: 'EJ', book: 'Salt & Honey', quote: showcaseReviews[2].text, rating: 5, color: 'orange' },
  ],
}

export function getShowcaseBook(slug: string): BookDetailsResponse | null {
  const book = showcaseBooks.find((item) => item.slug === slug)
  if (!book) return null

  const reviewBySlug: Record<string, CommunityReview[]> = {
    'apricot-skies': [showcaseReviews[0]],
    'the-green-room': [showcaseReviews[1]],
    'salt-and-honey': [showcaseReviews[2]],
  }

  return {
    book,
    reviews: reviewBySlug[slug] ?? [],
    clubs: slug === 'the-sunday-chapter' ? [{
      id: 'club-sunday',
      slug: 'sunday-book-club',
      name: 'Sunday Book Club',
      description: showcaseEvent.club?.description ?? '',
      selectionStatus: 'current',
      nextEvent: {
        id: showcaseEvent.id,
        title: showcaseEvent.title,
        startsAt: showcaseEvent.startsAt,
        location: showcaseEvent.location,
      },
    }] : [],
    viewer: { readingStatus: null, reviewId: null },
  }
}
