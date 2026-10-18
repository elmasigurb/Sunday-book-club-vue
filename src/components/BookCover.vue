<script setup lang="ts">
import type { Book } from '../types'

withDefaults(defineProps<{ book: Book; compact?: boolean }>(), { compact: false })
</script>

<template>
  <div class="shelf-cover reusable-cover" :class="[book.coverClass, { compact }]" role="img" :aria-label="`Cover of ${book.title}`">
    <img v-if="book.coverImageUrl" :src="book.coverImageUrl" alt="" />
    <small>{{ book.coverKicker ?? book.genre }}</small>
    <strong>{{ book.title }}</strong>
    <i aria-hidden="true"></i>
    <span class="cover-author">{{ book.author }}</span>
  </div>
</template>
