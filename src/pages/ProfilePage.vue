<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  cancelMeetingRsvp,
  deleteReview,
  getProfile,
  removeReadingStatus,
  setReadingStatus,
  updateProfile,
  updateReview,
} from '../api'
import BookCover from '../components/BookCover.vue'
import { useAuth } from '../composables/useAuth'
import type { ProfileResponse, ReadingStatus } from '../types'

type Tab = 'upcoming' | 'attended' | 'bookshelf' | 'reviews'
const { session, initializing } = useAuth()
const data = ref<ProfileResponse | null>(null)
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const activeTab = ref<Tab>('upcoming')
const editingProfile = ref(false)
const pending = ref(false)
const profileForm = ref({ username: '', displayName: '', bio: '', avatarUrl: '' })
const editingReview = ref<{ id: string; text: string; rating: number } | null>(null)

const initials = computed(() => (data.value?.profile.displayName ?? 'Reader')
  .split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase())

async function loadProfile() {
  if (!session.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    data.value = await getProfile()
    profileForm.value = {
      username: data.value.profile.username,
      displayName: data.value.profile.displayName,
      bio: data.value.profile.bio,
      avatarUrl: data.value.profile.avatarUrl,
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Your reading corner could not be loaded.'
  } finally {
    loading.value = false
  }
}

async function saveProfile() {
  pending.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    await updateProfile({
      username: profileForm.value.username,
      displayName: profileForm.value.displayName,
      bio: profileForm.value.bio || null,
      avatarUrl: profileForm.value.avatarUrl || null,
    })
    editingProfile.value = false
    successMessage.value = 'Your reading corner has been updated.'
    await loadProfile()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Your profile could not be saved.'
  } finally {
    pending.value = false
  }
}

async function cancelRegistration(eventId: string) {
  if (!window.confirm('Cancel your registration for this event?')) return
  try {
    await cancelMeetingRsvp(eventId)
    successMessage.value = 'Your registration has been cancelled.'
    await loadProfile()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The registration could not be cancelled.'
  }
}

async function changeShelf(bookId: string, event: Event) {
  try {
    await setReadingStatus(bookId, (event.target as HTMLSelectElement).value as ReadingStatus)
    await loadProfile()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The reading status could not be updated.'
  }
}

async function removeShelf(bookId: string) {
  if (!window.confirm('Remove this book from your bookshelf?')) return
  try {
    await removeReadingStatus(bookId)
    await loadProfile()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The book could not be removed.'
  }
}

async function saveReview() {
  if (!editingReview.value) return
  pending.value = true
  try {
    await updateReview(editingReview.value.id, editingReview.value.rating, editingReview.value.text)
    editingReview.value = null
    await loadProfile()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The review could not be updated.'
  } finally {
    pending.value = false
  }
}

async function removeReview(reviewId: string) {
  if (!window.confirm('Delete this review? This cannot be undone.')) return
  try {
    await deleteReview(reviewId)
    await loadProfile()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The review could not be deleted.'
  }
}

watch(session, (nextSession) => {
  if (nextSession) void loadProfile()
  else data.value = null
}, { immediate: true })
</script>

<template>
  <main class="profile-page">
    <div v-if="initializing || loading" class="page-state section-pad" role="status">Arranging your reading corner…</div>
    <section v-else-if="!session" class="profile-signin section-pad">
      <div class="page-shell inline-state">
        <span aria-hidden="true">✿</span>
        <p class="eyebrow">Members only</p>
        <h1>Your reading corner<br />is waiting.</h1>
        <p>Sign in with your secure email link to see your events, shelf, and reviews.</p>
        <RouterLink class="button button-burgundy" :to="{ name: 'home', hash: '#member-access' }">Member sign in</RouterLink>
      </div>
    </section>
    <div v-else-if="errorMessage && !data" class="page-state section-pad" role="alert">
      <h2>We couldn’t open your corner.</h2><p>{{ errorMessage }}</p>
      <button class="button button-burgundy" type="button" @click="loadProfile">Try again</button>
    </div>
    <template v-else-if="data">
      <section class="profile-hero section-pad">
        <div class="page-shell profile-hero-grid">
          <div class="profile-avatar-wrap">
            <img v-if="data.profile.avatarUrl" :src="data.profile.avatarUrl" :alt="data.profile.displayName" class="profile-avatar" />
            <div v-else class="profile-avatar profile-avatar-fallback">{{ initials }}</div>
            <span aria-hidden="true">✿</span>
          </div>
          <div class="profile-intro">
            <p class="eyebrow">My Reading Corner</p>
            <h1>{{ data.profile.displayName }}</h1>
            <p class="profile-username">@{{ data.profile.username }}</p>
            <p class="profile-bio">{{ data.profile.bio || 'A quiet corner for books, conversations, and Sunday notes.' }}</p>
            <p class="member-since">Member since {{ new Date(data.profile.memberSince).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }}</p>
            <button class="text-link text-button" type="button" @click="editingProfile = !editingProfile">{{ editingProfile ? 'Close editor' : 'Edit my corner' }} →</button>
          </div>
          <dl class="profile-stats">
            <div><dt>{{ data.stats.booksRead }}</dt><dd>Books read</dd></div>
            <div><dt>{{ data.stats.eventsAttended }}</dt><dd>Events attended</dd></div>
            <div><dt>{{ data.stats.reviewsWritten }}</dt><dd>Reviews written</dd></div>
          </dl>
        </div>
        <form v-if="editingProfile" class="page-shell profile-editor" @submit.prevent="saveProfile">
          <label><span>Display name</span><input v-model="profileForm.displayName" minlength="2" maxlength="100" required /></label>
          <label><span>Username</span><input v-model="profileForm.username" pattern="[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*" minlength="3" maxlength="50" required /></label>
          <label class="wide"><span>Profile image URL</span><input v-model="profileForm.avatarUrl" type="url" placeholder="https://…" /></label>
          <label class="wide"><span>Short bio</span><textarea v-model="profileForm.bio" maxlength="500" placeholder="Tell the club what you love to read."></textarea></label>
          <button class="button button-orange" type="submit" :disabled="pending">{{ pending ? 'Saving…' : 'Save profile' }}</button>
        </form>
      </section>

      <section class="journal-section section-pad">
        <div class="page-shell">
          <div class="profile-tabs" role="tablist" aria-label="Reading corner sections">
            <button v-for="tab in ([['upcoming', 'Upcoming Events'], ['attended', 'Attended Events'], ['bookshelf', 'My Bookshelf'], ['reviews', 'My Reviews']] as const)"
              :key="tab[0]" type="button" role="tab" :aria-selected="activeTab === tab[0]" :class="{ active: activeTab === tab[0] }" @click="activeTab = tab[0]">
              {{ tab[1] }}
            </button>
          </div>
          <p v-if="successMessage" class="status-banner" role="status">{{ successMessage }}</p>
          <p v-if="errorMessage" class="form-error profile-error" role="alert">{{ errorMessage }}</p>

          <div v-if="activeTab === 'upcoming'" class="journal-list">
            <article v-for="event in data.upcomingEvents" :key="event.id" class="event-row">
              <div class="event-date"><strong>{{ new Date(event.startsAt).toLocaleDateString('en-GB', { day: '2-digit' }) }}</strong><span>{{ new Date(event.startsAt).toLocaleDateString('en-GB', { month: 'short' }) }}</span></div>
              <div><span class="genre-pill">{{ event.registrationStatus }}</span><h3>{{ event.title }}</h3><p>{{ new Date(event.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }} · {{ event.location }}</p><p>Reading <RouterLink :to="{ name: 'book', params: { slug: event.book.slug } }">{{ event.book.title }}</RouterLink></p></div>
              <div class="row-actions"><RouterLink class="text-link" :to="{ name: 'event', params: { id: event.id } }">Event details →</RouterLink><button class="text-button danger" type="button" @click="cancelRegistration(event.id)">Cancel registration</button></div>
            </article>
            <div v-if="!data.upcomingEvents.length" class="inline-state"><span>✿</span><h2>No upcoming plans—yet.</h2><p>Your next registered Sunday will appear here.</p></div>
          </div>

          <div v-else-if="activeTab === 'attended'" class="journal-list">
            <article v-for="event in data.attendedEvents" :key="event.id" class="event-row">
              <div class="event-date attended"><strong>✓</strong><span>Confirmed</span></div>
              <div><span class="genre-pill">Attendance confirmed</span><h3>{{ event.title }}</h3><p>{{ new Date(event.startsAt).toLocaleDateString('en-GB', { dateStyle: 'long' }) }} · {{ event.location }}</p><p>Discussed <RouterLink :to="{ name: 'book', params: { slug: event.book.slug } }">{{ event.book.title }}</RouterLink></p></div>
              <RouterLink class="text-link" :to="{ name: 'event', params: { id: event.id } }">Revisit event →</RouterLink>
            </article>
            <div v-if="!data.attendedEvents.length" class="inline-state"><span>✿</span><h2>No confirmed attendance yet.</h2><p>Registered events only move here after an organizer confirms attendance.</p></div>
          </div>

          <div v-else-if="activeTab === 'bookshelf'" class="bookshelf-list">
            <article v-for="item in data.bookshelf" :key="item.id" class="shelf-row">
              <RouterLink :to="{ name: 'book', params: { slug: item.book.slug } }"><BookCover :book="item.book" compact /></RouterLink>
              <div><span class="genre-pill">{{ item.book.genre }}</span><h3><RouterLink :to="{ name: 'book', params: { slug: item.book.slug } }">{{ item.book.title }}</RouterLink></h3><p>by {{ item.book.author }}</p></div>
              <label><span>Reading status</span><select :value="item.status" @change="changeShelf(item.book.id, $event)"><option value="want_to_read">Want to Read</option><option value="currently_reading">Currently Reading</option><option value="read">Read</option></select></label>
              <button class="text-button danger" type="button" @click="removeShelf(item.book.id)">Remove</button>
            </article>
            <div v-if="!data.bookshelf.length" class="inline-state"><span>✿</span><h2>Your shelf has room.</h2><p>Explore the catalogue and choose a reading status to add a book.</p><RouterLink class="button button-orange" :to="{ name: 'explore' }">Explore books</RouterLink></div>
          </div>

          <div v-else class="journal-list">
            <article v-for="review in data.reviews" :key="review.id" class="my-review-row">
              <RouterLink :to="{ name: 'book', params: { slug: review.book.slug } }"><BookCover :book="{ ...review.book, genre: '', rating: review.rating }" compact /></RouterLink>
              <div class="my-review-copy"><span class="stars">{{ '★'.repeat(review.rating) }}</span><span v-if="!review.approved" class="genre-pill">Pending approval</span><h3>{{ review.book.title }}</h3><p v-if="editingReview?.id !== review.id">“{{ review.text }}”</p><form v-else class="inline-review-editor" @submit.prevent="saveReview"><select v-model="editingReview.rating"><option v-for="star in 5" :key="star" :value="star">{{ star }} stars</option></select><textarea v-model="editingReview.text" minlength="10" maxlength="1000" required></textarea><button class="button button-small button-burgundy" type="submit">Save</button><button class="text-button" type="button" @click="editingReview = null">Cancel</button></form><small>{{ new Date(review.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }) }}</small></div>
              <div class="row-actions"><button class="text-button" type="button" @click="editingReview = { id: review.id, text: review.text, rating: review.rating }">Edit</button><button class="text-button danger" type="button" @click="removeReview(review.id)">Delete</button></div>
            </article>
            <div v-if="!data.reviews.length" class="inline-state"><span>✿</span><h2>No reviews yet.</h2><p>Open a book to share your first reading note.</p><RouterLink class="button button-orange" :to="{ name: 'explore' }">Find a book</RouterLink></div>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>
