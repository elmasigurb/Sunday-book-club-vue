<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { searchBooks } from '../api'
import BookCard from '../components/BookCard.vue'
import type { Book } from '../types'

const route = useRoute()
const router = useRouter()
const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const genre = ref(typeof route.query.genre === 'string' ? route.query.genre : '')
const sort = ref(typeof route.query.sort === 'string' ? route.query.sort : 'title')
const books = ref<Book[]>([])
const genres = ref<string[]>([])
const loading = ref(true)
const errorMessage = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let requestNumber = 0

async function loadBooks() {
  const currentRequest = ++requestNumber
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await searchBooks({ search: search.value, genre: genre.value, sort: sort.value })
    if (currentRequest !== requestNumber) return
    books.value = result.books
    genres.value = result.genres
    await router.replace({
      query: {
        ...(search.value ? { q: search.value } : {}),
        ...(genre.value ? { genre: genre.value } : {}),
        ...(sort.value !== 'title' ? { sort: sort.value } : {}),
      },
    })
  } catch (error) {
    if (currentRequest !== requestNumber) return
    errorMessage.value = error instanceof Error ? error.message : 'Books could not be loaded.'
  } finally {
    if (currentRequest === requestNumber) loading.value = false
  }
}

watch(search, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadBooks, 300)
})
watch([genre, sort], loadBooks)
onMounted(loadBooks)
onBeforeUnmount(() => clearTimeout(debounceTimer))
</script>

<template>
  <main class="explore-page">
    <section class="inner-hero section-pad">
      <div class="page-shell inner-hero-grid">
        <div>
          <p class="eyebrow">A curated digital bookstore</p>
          <h1>Explore <em>books.</em></h1>
          <p>Find your next Sunday read by title, author, or the sort of story you feel like entering.</p>
        </div>
        <span class="hero-orb" aria-hidden="true">✦</span>
      </div>
    </section>

    <section class="catalogue-section section-pad">
      <div class="page-shell">
        <div class="catalogue-tools" role="search">
          <label class="search-field">
            <span>Search by title or author</span>
            <input v-model="search" type="search" placeholder="Try “Salt” or “Nora Bell”" autocomplete="off" />
          </label>
          <label>
            <span>Genre</span>
            <select v-model="genre">
              <option value="">All genres</option>
              <option v-for="item in genres" :key="item" :value="item">{{ item }}</option>
            </select>
          </label>
          <label>
            <span>Sort by</span>
            <select v-model="sort">
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="rating">Community rating</option>
            </select>
          </label>
        </div>

        <p class="results-count" aria-live="polite">
          {{ loading ? 'Searching the shelves…' : `${books.length} ${books.length === 1 ? 'book' : 'books'} found` }}
        </p>
        <div v-if="loading" class="book-grid skeleton-grid" aria-hidden="true">
          <div v-for="index in 4" :key="index" class="skeleton-book"></div>
        </div>
        <div v-else-if="errorMessage" class="inline-state" role="alert">
          <h2>We lost our place.</h2><p>{{ errorMessage }}</p>
          <button class="button button-burgundy" type="button" @click="loadBooks">Try again</button>
        </div>
        <div v-else-if="books.length" class="book-grid explore-grid">
          <BookCard v-for="(book, index) in books" :key="book.id" :book="book" :index="index" />
        </div>
        <div v-else class="inline-state">
          <span aria-hidden="true">✿</span>
          <h2>No books on this shelf yet.</h2>
          <p>Try another title, author, or genre.</p>
          <button class="text-button" type="button" @click="search = ''; genre = ''">Clear the search</button>
        </div>
      </div>
    </section>
  </main>
</template>
