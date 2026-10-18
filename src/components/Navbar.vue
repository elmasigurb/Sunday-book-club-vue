<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const { session } = useAuth()
const route = useRoute()
const menuOpen = ref(false)

const links = [
  { label: 'Home', to: { name: 'home' } },
  { label: 'This Month', to: { name: 'home', hash: '#this-month' } },
  { label: 'Explore Books', to: { name: 'explore' } },
  { label: 'Meetings', to: { name: 'home', hash: '#meetings' } },
]
</script>

<template>
  <header class="site-header">
    <nav class="navbar page-shell" aria-label="Main navigation">
      <RouterLink class="brand" :to="{ name: 'home' }" aria-label="Sunday Book Club home" @click="menuOpen = false">
        <span class="brand-flower" aria-hidden="true"><i></i></span>
        <span>Sunday<br />Book Club</span>
      </RouterLink>
      <div class="nav-links" :class="{ open: menuOpen }">
        <RouterLink v-for="link in links" :key="link.label" :to="link.to" :class="{ active: route.name === link.to.name && (!link.to.hash || route.hash === link.to.hash) }" @click="menuOpen = false">
          {{ link.label }}
        </RouterLink>
        <RouterLink class="mobile-account-link" :to="session ? { name: 'profile' } : { name: 'home', hash: '#member-access' }" @click="menuOpen = false">
          {{ session ? 'My Reading Corner' : 'Member Login' }}
        </RouterLink>
      </div>
      <RouterLink class="button button-small button-burgundy" :to="session ? { name: 'profile' } : { name: 'home', hash: '#member-access' }">
        {{ session ? 'My Corner' : 'Member Login' }} <span aria-hidden="true">↗</span>
      </RouterLink>
      <button class="menu-toggle" type="button" :aria-expanded="menuOpen" aria-label="Toggle navigation" @click="menuOpen = !menuOpen"><span></span><span></span></button>
    </nav>
  </header>
</template>
