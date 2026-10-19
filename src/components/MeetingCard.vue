<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Meeting } from '../types'
import { rsvpToMeeting } from '../api'
import { useAuth } from '../composables/useAuth'

const props = defineProps<{ meeting: Meeting | null }>()
const { session } = useAuth()
const rsvpMessage = ref('')
const rsvpError = ref('')
const rsvpPending = ref(false)

async function saveSpot() {
  if (!props.meeting?.id) return
  rsvpPending.value = true
  rsvpMessage.value = ''
  rsvpError.value = ''
  try {
    const result = await rsvpToMeeting(props.meeting.id)
    rsvpMessage.value = result.status === 'attending'
      ? 'Your spot is saved. See you Sunday!'
      : 'The meeting is full, so you have been added to the waitlist.'
  } catch (error) {
    rsvpError.value = error instanceof Error ? error.message : 'Could not save your spot.'
  } finally {
    rsvpPending.value = false
  }
}

const startsAt = computed(() => props.meeting ? new Date(props.meeting.startsAt) : null)
const endsAt = computed(() => props.meeting ? new Date(props.meeting.endsAt) : null)
const day = computed(() => startsAt.value?.toLocaleDateString('en-GB', { day: '2-digit', timeZone: 'Atlantic/Reykjavik' }) ?? '18')
const month = computed(() => startsAt.value?.toLocaleDateString('en-GB', { month: 'long', timeZone: 'Atlantic/Reykjavik' }) ?? 'October')
const weekday = computed(() => startsAt.value?.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'Atlantic/Reykjavik' }) ?? 'Sunday')
const time = computed(() => {
  if (!startsAt.value || !endsAt.value) return '14:00–16:00'
  const format = (date: Date) => date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Atlantic/Reykjavik' })
  return `${format(startsAt.value)}–${format(endsAt.value)}`
})
</script>

<template>
  <section id="meetings" class="meeting-section section-pad">
    <div class="meeting-orbit orbit-one" aria-hidden="true"></div>
    <div class="meeting-orbit orbit-two" aria-hidden="true"></div>
    <div class="page-shell meeting-grid">
      <div class="meeting-intro">
        <p class="eyebrow light">Next book club meeting</p>
        <h2>Let’s talk<br /><em>books.</em></h2>
        <p>Come as you are. Bring your thoughts, your dog-eared copy, and an appetite for cake.</p>
        <button v-if="session && meeting" class="button button-lime" type="button" :disabled="rsvpPending" @click="saveSpot">
          {{ rsvpPending ? 'Saving…' : 'Save my spot' }} <span v-if="!rsvpPending" aria-hidden="true">→</span>
        </button>
        <a v-else class="button button-lime" href="#member-access">Sign in to RSVP <span aria-hidden="true">→</span></a>
        <p v-if="rsvpMessage" class="meeting-feedback" role="status">{{ rsvpMessage }}</p>
        <p v-if="rsvpError" class="meeting-feedback meeting-error" role="alert">{{ rsvpError }}</p>
        <RouterLink v-if="meeting" class="meeting-detail-link" :to="{ name: 'event', params: { id: meeting.id } }">Open event details →</RouterLink>
      </div>
      <article class="meeting-card">
        <div class="meeting-date"><strong>{{ day }}</strong><span>{{ month }}<br />{{ weekday }}</span></div>
        <dl>
          <div><dt>Time</dt><dd>{{ time }}</dd></div>
          <div><dt>Location</dt><dd>{{ meeting?.location ?? 'Sunday Studio, Reykjavík' }}</dd></div>
          <div><dt>Reading</dt><dd><RouterLink v-if="meeting?.bookSlug" :to="{ name: 'book', params: { slug: meeting.bookSlug } }">{{ meeting.bookTitle }}</RouterLink><template v-else>{{ meeting?.bookTitle ?? 'The Sunday Chapter' }}</template><br /><span>{{ meeting?.bookAuthor ?? 'June Harper' }}</span></dd></div>
        </dl>
        <div class="meeting-note"><span>✿</span> {{ meeting?.note ?? 'Coffee, cake & good conversation included' }}</div>
      </article>
    </div>
  </section>
</template>
