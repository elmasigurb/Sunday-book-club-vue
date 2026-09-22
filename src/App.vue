<script setup lang="ts">
import Navbar from './components/Navbar.vue'
import Hero from './components/Hero.vue'
import FeaturedBook from './components/FeaturedBook.vue'
import BookCard from './components/BookCard.vue'
import MeetingCard from './components/MeetingCard.vue'
import ReviewCard from './components/ReviewCard.vue'
import JoinSection from './components/JoinSection.vue'
import Footer from './components/Footer.vue'
import type { Book, Review } from './types'

const books: Book[] = [
  { title: 'Apricot Skies', author: 'Mara Vale', genre: 'Romance', rating: 4.8, coverClass: 'cover-apricot', coverKicker: 'A love story' },
  { title: 'The Green Room', author: 'Elliot Pine', genre: 'Literary fiction', rating: 4.6, coverClass: 'cover-green' },
  { title: 'Salt & Honey', author: 'Nora Bell', genre: 'Memoir', rating: 4.9, coverClass: 'cover-salt', coverKicker: 'A memoir' },
  { title: 'After the Sun', author: 'Leonie Hart', genre: 'Short stories', rating: 4.7, coverClass: 'cover-sun', coverKicker: 'Stories' },
]

const reviews: Review[] = [
  { name: 'Anna', initials: 'AM', book: 'Apricot Skies', quote: 'I joined for the books and stayed for the people—and the truly excellent Sunday cake.', rating: 5, color: 'pink' },
  { name: 'Sara', initials: 'SK', book: 'The Green Room', quote: 'My favourite Sunday of every month. The kind of conversation that follows you home.', rating: 5, color: 'lime' },
  { name: 'Elín', initials: 'EJ', book: 'Salt & Honey', quote: 'It has completely changed how I read. Every book feels bigger when we unpack it together.', rating: 5, color: 'orange' },
]
</script>

<template>
  <Navbar />
  <main>
    <Hero />
    <FeaturedBook />

    <section class="shelves-section section-pad">
      <div class="page-shell">
        <div class="section-heading shelf-heading">
          <div><p class="eyebrow">From our reading list</p><h2>Currently on<br />our <em>shelves</em></h2></div>
          <p>Four books we can’t stop talking about. Pick one up and tell us what you think.</p>
        </div>
        <div class="book-grid">
          <BookCard v-for="(book, index) in books" :key="book.title" :book="book" :index="index" />
        </div>
      </div>
    </section>

    <MeetingCard />

    <section id="reviews" class="reviews-section section-pad">
      <div class="page-shell">
        <div class="section-heading reviews-heading"><p class="eyebrow">Notes from our members</p><h2>What the club<br />is <em>saying</em></h2></div>
        <div class="reviews-grid">
          <ReviewCard v-for="(review, index) in reviews" :key="review.name" :review="review" :index="index" />
        </div>
      </div>
    </section>

    <JoinSection />
  </main>
  <Footer />
</template>
