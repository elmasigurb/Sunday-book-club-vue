import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router'
import { isStaticShowcase } from './config'
import HomePage from './pages/HomePage.vue'

export const router = createRouter({
  history: isStaticShowcase
    ? createWebHashHistory(import.meta.env.BASE_URL)
    : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomePage },
    { path: '/explore', name: 'explore', component: () => import('./pages/ExploreBooksPage.vue') },
    { path: '/books/:slug', name: 'book', component: () => import('./pages/BookDetailsPage.vue') },
    { path: '/profile', name: 'profile', component: () => import('./pages/ProfilePage.vue') },
    { path: '/events/:id', name: 'event', component: () => import('./pages/EventDetailsPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior(to) {
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    return { top: 0 }
  },
})
