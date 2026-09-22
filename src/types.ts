export interface Book {
  title: string
  author: string
  genre: string
  rating: number
  coverClass: string
  coverKicker?: string
}

export interface Review {
  name: string
  initials: string
  book: string
  quote: string
  rating: number
  color: 'pink' | 'orange' | 'lime'
}
