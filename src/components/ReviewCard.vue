<script setup lang="ts">
import type { Review } from '../types'

defineProps<{ review: Review; index: number }>()
</script>

<template>
  <article class="review-card" :class="`review-${review.color}`">
    <div class="review-top">
      <span class="review-number">0{{ index + 1 }}</span>
      <span class="stars" :aria-label="`${review.rating} out of 5 stars`">{{ '★'.repeat(review.rating) }}</span>
    </div>
    <p>“{{ review.quote }}”</p>
    <div class="review-person">
      <span class="avatar">{{ review.initials }}</span>
      <div><strong>{{ review.name }}</strong><small>on <em>{{ review.book }}</em></small></div>
    </div>
  </article>
</template>
