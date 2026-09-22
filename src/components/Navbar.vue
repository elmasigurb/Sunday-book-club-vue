<script setup lang="ts">
const links = [
  ['Home', 'home'],
  ['This Month', 'this-month'],
  ['Reviews', 'reviews'],
  ['Meetings', 'meetings'],
  ['About', 'about'],
]
</script>

<template>
  <header class="site-header">
    <nav class="navbar page-shell" aria-label="Main navigation">
      <a class="brand" href="#home" aria-label="Sunday Book Club home">
        <span class="brand-flower" aria-hidden="true"><i></i></span>
        <span>Sunday<br />Book Club</span>
      </a>
      <div class="nav-links">
        <a v-for="([label, id], index) in links" :key="id" :href="`#${id}`" :class="{ active: index === 0 }">
          {{ label }}
        </a>
      </div>
      <a class="button button-small button-burgundy" href="#join">Join the Club <span aria-hidden="true">↗</span></a>
    </nav>
  </header>
</template>
