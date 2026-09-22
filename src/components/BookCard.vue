<script setup lang="ts">
import type { Book } from '../types'

defineProps<{ book: Book; index: number }>()
</script>

<template>
  <article class="book-card">
    <div class="shelf-cover" :class="book.coverClass">
      <span class="cover-index">0{{ index + 1 }}</span>
      <small>{{ book.coverKicker ?? 'A novel' }}</small>
      <strong>{{ book.title }}</strong>
      <i aria-hidden="true"></i>
      <span class="cover-author">{{ book.author }}</span>
    </div>
    <div class="book-card-copy">
      <span class="genre-pill">{{ book.genre }}</span>
      <h3>{{ book.title }}</h3>
      <div><span>by {{ book.author }}</span><span class="rating">★ {{ book.rating.toFixed(1) }}</span></div>
    </div>
  </article>
</template>
