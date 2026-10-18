<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { cancelMeetingRsvp, getEvent, rsvpToMeeting } from '../api'
import BookCover from '../components/BookCover.vue'
import { useAuth } from '../composables/useAuth'
import { isStaticShowcase } from '../config'
import type { EventDetails } from '../types'

const route = useRoute()
const { session } = useAuth()
const event = ref<EventDetails | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const statusMessage = ref('')
const pending = ref(false)
const eventId = computed(() => String(route.params.id))

async function loadEvent() {
  loading.value = true
  errorMessage.value = ''
  try {
    event.value = (await getEvent(eventId.value)).event
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'The event could not be loaded.'
  } finally {
    loading.value = false
  }
}

async function register() {
  pending.value = true
  try {
    const result = await rsvpToMeeting(eventId.value)
    statusMessage.value = result.status === 'attending' ? 'Your spot is saved.' : 'You are on the waitlist.'
    await loadEvent()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Your spot could not be saved.'
  } finally {
    pending.value = false
  }
}

async function cancel() {
  if (!window.confirm('Cancel your registration for this event?')) return
  pending.value = true
  try {
    await cancelMeetingRsvp(eventId.value)
    statusMessage.value = 'Your registration has been cancelled.'
    await loadEvent()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Your registration could not be cancelled.'
  } finally {
    pending.value = false
  }
}

onMounted(loadEvent)
watch(eventId, loadEvent)
watch(session, () => { void loadEvent() })
</script>

<template>
  <main class="event-details-page">
    <div v-if="loading" class="page-state section-pad">Setting the table for Sunday…</div>
    <div v-else-if="errorMessage && !event" class="page-state section-pad" role="alert"><h2>We couldn’t find that gathering.</h2><p>{{ errorMessage }}</p><RouterLink class="button button-burgundy" :to="{ name: 'home' }">Back home</RouterLink></div>
    <section v-else-if="event" class="event-feature section-pad">
      <div class="page-shell event-feature-grid">
        <div class="event-date-poster">
          <span>{{ new Date(event.startsAt).toLocaleDateString('en-GB', { weekday: 'long' }) }}</span>
          <strong>{{ new Date(event.startsAt).toLocaleDateString('en-GB', { day: '2-digit' }) }}</strong>
          <em>{{ new Date(event.startsAt).toLocaleDateString('en-GB', { month: 'long' }) }}</em>
          <small>{{ new Date(event.startsAt).toLocaleDateString('en-GB', { year: 'numeric' }) }}</small>
        </div>
        <div class="event-feature-copy">
          <p class="eyebrow">{{ event.club?.name ?? 'Sunday Book Club' }}</p>
          <h1>{{ event.title }}</h1>
          <p class="event-lead">{{ event.description || 'A thoughtful Sunday conversation around a book worth sharing.' }}</p>
          <dl class="event-meta">
            <div><dt>Time</dt><dd>{{ new Date(event.startsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }}–{{ new Date(event.endsAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) }}</dd></div>
            <div><dt>Location</dt><dd>{{ event.location }}</dd></div>
            <div v-if="event.capacity"><dt>Capacity</dt><dd>{{ event.capacity }} readers</dd></div>
          </dl>
          <p v-if="event.note" class="event-note"><span>✿</span> {{ event.note }}</p>
          <div class="event-actions">
            <span v-if="isStaticShowcase" class="registration-badge">RSVP available with live API</span>
            <template v-else-if="session">
              <button v-if="!event.registration || event.registration.status === 'cancelled'" class="button button-orange" type="button" :disabled="pending" @click="register">{{ pending ? 'Saving…' : 'Save my spot' }}</button>
              <template v-else><span class="registration-badge">{{ event.registration.status === 'attending' ? 'You’re registered' : 'You’re waitlisted' }}</span><button class="text-button danger" type="button" :disabled="pending" @click="cancel">Cancel registration</button></template>
            </template>
            <RouterLink v-else class="button button-orange" :to="{ name: 'home', hash: '#member-access' }">Sign in to RSVP</RouterLink>
          </div>
          <p v-if="statusMessage" class="status-banner" role="status">{{ statusMessage }}</p>
          <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
        </div>
      </div>
      <div class="page-shell event-book-feature">
        <RouterLink :to="{ name: 'book', params: { slug: event.book.slug } }"><BookCover :book="event.book" compact /></RouterLink>
        <div><p class="eyebrow">Featured book</p><h2>{{ event.book.title }}</h2><p>by {{ event.book.author }}</p><RouterLink class="text-link" :to="{ name: 'book', params: { slug: event.book.slug } }">Open book details →</RouterLink></div>
        <p v-if="event.club">{{ event.club.description }}</p>
      </div>
    </section>
  </main>
</template>
