<script setup lang="ts">
import type { Book } from '../types'

defineProps<{ book: Book }>()
</script>

<template>
  <section id="this-month" class="featured-section section-pad">
    <div class="page-shell">
      <div class="section-heading split-heading">
        <div>
          <p class="eyebrow">October pick <span>№ 10</span></p>
          <h2>Book of the <em>month</em></h2>
        </div>
        <p>A quietly powerful story, chosen by the club and best enjoyed with tea and a free afternoon.</p>
      </div>

      <article class="featured-card">
        <div class="featured-cover-wrap">
          <RouterLink
            class="featured-cover-link"
            :to="book.slug ? { name: 'book', params: { slug: book.slug } } : { name: 'explore' }"
            :aria-label="`Open ${book.title} by ${book.author}`"
          >
            <div class="featured-cover" role="img" :aria-label="`Cover of ${book.title}`">
              <div class="featured-cover-sun"></div>
              <span class="cover-kicker">{{ book.coverKicker ?? 'A Novel' }}</span>
              <h3>{{ book.title }}</h3>
              <p>{{ book.author }}</p>
            </div>
          </RouterLink>
          <span class="round-sticker">Our<br /><strong>pick!</strong></span>
        </div>
        <div class="featured-details">
          <div class="featured-meta"><span>{{ book.genre }}</span><span>{{ book.pages ?? 304 }} pages</span><span>{{ book.publicationYear ?? 2026 }}</span></div>
          <p class="eyebrow">This month we’re reading</p>
          <h3>{{ book.title }}</h3>
          <p class="featured-author">by {{ book.author }}</p>
          <p class="featured-description">{{ book.description }}</p>
          <div class="quote-line"><span>“{{ book.pullQuote }}”</span><span class="stars" :aria-label="`${book.rating} out of 5 stars`">{{ '★'.repeat(Math.round(book.rating)) }}</span></div>
          <RouterLink
            class="button button-orange"
            :to="book.slug ? { name: 'book', params: { slug: book.slug } } : { name: 'explore' }"
          >Read with us <span aria-hidden="true">→</span></RouterLink>
        </div>
      </article>
    </div>
  </section>
</template>
