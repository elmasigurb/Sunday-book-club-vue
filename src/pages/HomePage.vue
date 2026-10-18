<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSiteContent } from '../api'
import BookCard from '../components/BookCard.vue'
import FeaturedBook from '../components/FeaturedBook.vue'
import Hero from '../components/Hero.vue'
import JoinSection from '../components/JoinSection.vue'
import MeetingCard from '../components/MeetingCard.vue'
import MemberAccess from '../components/MemberAccess.vue'
import ReviewCard from '../components/ReviewCard.vue'
import type { Book, Meeting, Review } from '../types'

const books = ref<Book[]>([])
const reviews = ref<Review[]>([])
const featuredBook = ref<Book | null>(null)
const nextMeeting = ref<Meeting | null>(null)
const loading = ref(true)
const errorMessage = ref('')

async function loadContent() {
  loading.value = true
  errorMessage.value = ''
  try {
    const content = await getSiteContent()
    books.value = content.books
    reviews.value = content.reviews
    featuredBook.value = content.featuredBook
    nextMeeting.value = content.nextMeeting
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The reading list could not be loaded.'
  } finally {
    loading.value = false
  }
}

onMounted(loadContent)
</script>

<template>
  <main>
    <Hero />
    <div v-if="loading" class="page-state section-pad" role="status">Opening the reading list…</div>
    <div v-else-if="errorMessage" class="page-state section-pad" role="alert">
      <span aria-hidden="true">✿</span>
      <h2>Our books are taking a moment.</h2>
      <p>{{ errorMessage }}</p>
      <button class="button button-burgundy" type="button" @click="loadContent">Try again</button>
    </div>
    <template v-else>
      <FeaturedBook v-if="featuredBook" :book="featuredBook" />

      <section class="shelves-section section-pad">
        <div class="page-shell">
          <div class="section-heading shelf-heading">
            <div><p class="eyebrow">From our reading list</p><h2>Currently on<br />our <em>shelves</em></h2></div>
            <p>Four books we can’t stop talking about. Pick one up and tell us what you think.</p>
          </div>
          <div v-if="books.length" class="book-grid">
            <BookCard v-for="(book, index) in books" :key="book.id ?? book.title" :book="book" :index="index" />
          </div>
          <p v-else class="empty-note">The shelf is ready for its first book.</p>
        </div>
      </section>

      <MeetingCard :meeting="nextMeeting" />
      <MemberAccess />

      <section id="reviews" class="reviews-section section-pad">
        <div class="page-shell">
          <div class="section-heading reviews-heading"><p class="eyebrow">Notes from our members</p><h2>What the club<br />is <em>saying</em></h2></div>
          <div v-if="reviews.length" class="reviews-grid">
            <ReviewCard v-for="(review, index) in reviews" :key="review.id ?? review.name" :review="review" :index="index" />
          </div>
          <p v-else class="empty-note">No notes yet. The first page is yours.</p>
        </div>
      </section>

      <JoinSection />
    </template>
  </main>
</template>
