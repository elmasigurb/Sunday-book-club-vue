import type {
  BookDetailsResponse,
  EventDetails,
  ProfileResponse,
  ReadingStatus,
  SiteContent,
} from './types'
import { isStaticShowcase, unavailableInShowcaseMessage } from './config'
import { getShowcaseBook, showcaseBooks, showcaseContent, showcaseEvent } from './fallback-data'
import { supabase } from './lib/supabase'

const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function request<T>(
  path: string,
  options?: RequestInit,
  authenticated: boolean | 'optional' = false,
): Promise<T> {
  let authorization: Record<string, string> = {}
  if (authenticated) {
    if (!supabase) throw new Error(unavailableInShowcaseMessage)
    const { data } = await supabase.auth.getSession()
    if (!data.session?.access_token && authenticated === true) throw new Error('Please sign in first')
    if (data.session?.access_token) authorization = { Authorization: `Bearer ${data.session.access_token}` }
  }

  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authorization,
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Request failed with status ${response.status}`)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function getSiteContent() {
  if (isStaticShowcase) return Promise.resolve(showcaseContent)
  return request<SiteContent>('/content')
}

export function joinClub(name: string, email: string) {
  if (isStaticShowcase) return Promise.reject(new Error(unavailableInShowcaseMessage))
  return request<{ member: { id: string; name: string; email: string } }>('/members', {
    method: 'POST',
    body: JSON.stringify({ name, email }),
  })
}

export function getAccount() {
  return request<{ member: { id: string; name: string; email: string } }>(
    '/account',
    undefined,
    true,
  )
}

export function rsvpToMeeting(meetingId: string) {
  return request<{ status: 'attending' | 'waitlisted' }>(
    `/meetings/${encodeURIComponent(meetingId)}/rsvp`,
    { method: 'POST' },
    true,
  )
}

export function cancelMeetingRsvp(meetingId: string) {
  return request<void>(
    `/meetings/${encodeURIComponent(meetingId)}/rsvp`,
    { method: 'DELETE' },
    true,
  )
}

export function searchBooks(filters: { search?: string; genre?: string; sort?: string }) {
  if (isStaticShowcase) {
    const search = filters.search?.trim().toLowerCase() ?? ''
    const genre = filters.genre?.trim().toLowerCase() ?? ''
    const books = showcaseBooks
      .filter((book) => !search || `${book.title} ${book.author}`.toLowerCase().includes(search))
      .filter((book) => !genre || book.genre.toLowerCase() === genre)
      .sort((a, b) => {
        if (filters.sort === 'author') return a.author.localeCompare(b.author)
        if (filters.sort === 'rating') return b.rating - a.rating
        return a.title.localeCompare(b.title)
      })
    const genres = [...new Set(showcaseBooks.map((book) => book.genre))].sort()
    return Promise.resolve({ books, genres })
  }
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.genre) params.set('genre', filters.genre)
  if (filters.sort) params.set('sort', filters.sort)
  const query = params.toString()
  return request<{ books: BookDetailsResponse['book'][]; genres: string[] }>(
    `/books${query ? `?${query}` : ''}`,
  )
}

export function getBookDetails(slug: string) {
  if (isStaticShowcase) {
    const details = getShowcaseBook(slug)
    return details
      ? Promise.resolve(details)
      : Promise.reject(new Error('This book could not be found.'))
  }
  return request<BookDetailsResponse>(`/books/${encodeURIComponent(slug)}`, undefined, 'optional')
}

export function setReadingStatus(bookId: string, status: ReadingStatus) {
  return request<{ status: ReadingStatus }>(
    `/books/${encodeURIComponent(bookId)}/reading-status`,
    { method: 'PUT', body: JSON.stringify({ status }) },
    true,
  )
}

export function removeReadingStatus(bookId: string) {
  return request<void>(
    `/books/${encodeURIComponent(bookId)}/reading-status`,
    { method: 'DELETE' },
    true,
  )
}

export function getProfile() {
  return request<ProfileResponse>('/profile', undefined, true)
}

export function updateProfile(input: {
  username: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
}) {
  return request<{ profile: Partial<ProfileResponse['profile']> }>(
    '/profile',
    { method: 'PATCH', body: JSON.stringify(input) },
    true,
  )
}

export function createReview(bookId: string, rating: number, text: string) {
  return request<{ review: { id: string } }>(
    `/books/${encodeURIComponent(bookId)}/reviews`,
    { method: 'POST', body: JSON.stringify({ rating, text }) },
    true,
  )
}

export function updateReview(reviewId: string, rating: number, text: string) {
  return request<{ review: { id: string } }>(
    `/reviews/${encodeURIComponent(reviewId)}`,
    { method: 'PATCH', body: JSON.stringify({ rating, text }) },
    true,
  )
}

export function deleteReview(reviewId: string) {
  return request<void>(
    `/reviews/${encodeURIComponent(reviewId)}`,
    { method: 'DELETE' },
    true,
  )
}

export function getEvent(eventId: string) {
  if (isStaticShowcase) {
    return eventId === showcaseEvent.id
      ? Promise.resolve({ event: showcaseEvent })
      : Promise.reject(new Error('This gathering could not be found.'))
  }
  return request<{ event: EventDetails }>(
    `/events/${encodeURIComponent(eventId)}`,
    undefined,
    'optional',
  )
}
