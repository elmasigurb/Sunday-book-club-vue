<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { createReview, deleteReview, getBookDetails, setReadingStatus, updateReview } from '../api'
import BookCover from '../components/BookCover.vue'
import { useAuth } from '../composables/useAuth'
import { isStaticShowcase } from '../config'
import type { BookDetailsResponse, CommunityReview, ReadingStatus } from '../types'

const route = useRoute()
const { session, initializing } = useAuth()
const details = ref<BookDetailsResponse | null>(null)
const loading = ref(true)
const errorMessage = ref('')
const actionError = ref('')
const statusPending = ref(false)
const reviewPending = ref(false)
const reviewText = ref('')
const reviewRating = ref(5)
const editingReviewId = ref<string | null>(null)

const slug = computed(() => String(route.params.slug))
const ownReview = computed(() => details.value?.reviews.find((review) => review.isOwn) ?? null)

async function loadBook() {
  loading.value = true
  errorMessage.value = ''
  try {
    details.value = await getBookDetails(slug.value)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'This book could not be loaded.'
  } finally {
    loading.value = false
  }
}

async function changeStatus(event: Event) {
  if (!details.value) return
  const status = (event.target as HTMLSelectElement).value as ReadingStatus
  statusPending.value = true
  actionError.value = ''
  try {
    await setReadingStatus(details.value.book.id, status)
    details.value.viewer.readingStatus = status
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Reading status could not be saved.'
  } finally {
    statusPending.value = false
  }
}

function beginEdit(review: CommunityReview) {
  editingReviewId.value = review.id
  reviewText.value = review.text
  reviewRating.value = review.rating
}

function cancelEdit() {
  editingReviewId.value = null
  reviewText.value = ''
  reviewRating.value = 5
}

async function saveReview() {
  if (!details.value) return
  reviewPending.value = true
  actionError.value = ''
  try {
    if (editingReviewId.value) {
      await updateReview(editingReviewId.value, reviewRating.value, reviewText.value)
    } else {
      await createReview(details.value.book.id, reviewRating.value, reviewText.value)
    }
    cancelEdit()
    await loadBook()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Your review could not be saved.'
  } finally {
    reviewPending.value = false
  }
}

async function removeReview(reviewId: string) {
  if (!window.confirm('Delete this review? This cannot be undone.')) return
  actionError.value = ''
  try {
    await deleteReview(reviewId)
    cancelEdit()
    await loadBook()
  } catch (error) {
    actionError.value = error instanceof Error ? error.message : 'Your review could not be deleted.'
  }
}

onMounted(loadBook)
watch(slug, loadBook)
watch(session, () => { void loadBook() })
</script>

<template>
  <main class="book-details-page">
    <div v-if="loading" class="page-state section-pad" role="status">Turning to the right page…</div>
    <div v-else-if="errorMessage || !details" class="page-state section-pad" role="alert">
      <span aria-hidden="true">✿</span><h2>That chapter is missing.</h2><p>{{ errorMessage }}</p>
      <RouterLink class="button button-burgundy" :to="{ name: 'explore' }">Explore books</RouterLink>
    </div>
    <template v-else>
      <section class="book-feature section-pad">
        <div class="page-shell book-feature-grid">
          <div class="book-feature-art"><BookCover :book="details.book" /></div>
          <div class="book-feature-copy">
            <p class="eyebrow">{{ details.book.genre }} · {{ details.book.publicationYear ?? 'Publication year unknown' }}</p>
            <h1>{{ details.book.title }}</h1>
            <p class="book-byline">by {{ details.book.author }}</p>
            <div class="rating-summary">
              <strong>★ {{ details.book.rating.toFixed(1) }}</strong>
              <span>{{ details.book.reviewCount }} community {{ details.book.reviewCount === 1 ? 'review' : 'reviews' }}</span>
            </div>
            <p class="book-synopsis">{{ details.book.description || 'A full synopsis is coming soon.' }}</p>
            <blockquote v-if="details.book.pullQuote">“{{ details.book.pullQuote }}”</blockquote>
            <div v-if="!initializing" class="reading-control">
              <span v-if="isStaticShowcase" class="genre-pill">Read-only showcase</span>
              <label v-else-if="session">
                <span>Your reading status</span>
                <select :value="details.viewer.readingStatus ?? ''" :disabled="statusPending" @change="changeStatus">
                  <option value="" disabled>Choose a status</option>
                  <option value="want_to_read">Want to Read</option>
                  <option value="currently_reading">Currently Reading</option>
                  <option value="read">Read</option>
                </select>
              </label>
              <RouterLink v-else class="button button-orange" :to="{ name: 'home', hash: '#member-access' }">Sign in to save</RouterLink>
              <p v-if="actionError" class="form-error" role="alert">{{ actionError }}</p>
            </div>
          </div>
        </div>
      </section>

      <section class="community-section section-pad">
        <div class="page-shell detail-section-grid">
          <div>
            <p class="eyebrow">Reader notes</p>
            <h2>Community <em>reviews.</em></h2>
          </div>
          <div v-if="isStaticShowcase" class="review-prompt">
            <p>Review writing is available when the live API is deployed.</p>
          </div>
          <form v-else-if="session && (!ownReview || editingReviewId)" class="review-editor" @submit.prevent="saveReview">
            <h3>{{ editingReviewId ? 'Edit your review' : 'Add your review' }}</h3>
            <fieldset>
              <legend>Your rating</legend>
              <label v-for="star in 5" :key="star" class="star-choice">
                <input v-model="reviewRating" type="radio" :value="star" />
                <span>{{ star }} ★</span>
              </label>
            </fieldset>
            <label><span>Your thoughts</span><textarea v-model="reviewText" minlength="10" maxlength="1000" required placeholder="What stayed with you?"></textarea></label>
            <div class="form-actions">
              <button class="button button-burgundy" type="submit" :disabled="reviewPending">{{ reviewPending ? 'Saving…' : 'Save review' }}</button>
              <button v-if="editingReviewId" class="text-button" type="button" @click="cancelEdit">Cancel</button>
            </div>
          </form>
          <div v-else-if="!session" class="review-prompt">
            <p>Read it too? Sign in to leave a note for the club.</p>
            <RouterLink class="text-link" :to="{ name: 'home', hash: '#member-access' }">Member sign in →</RouterLink>
          </div>
        </div>

        <div class="page-shell community-reviews">
          <article v-for="review in details.reviews" :key="review.id" class="community-review-card">
            <div class="review-person">
              <img v-if="review.avatarUrl" class="avatar" :src="review.avatarUrl" :alt="review.reviewerName" />
              <span v-else class="avatar">{{ review.initials }}</span>
              <div><strong>{{ review.reviewerName }}</strong><small>{{ new Date(review.createdAt).toLocaleDateString('en-GB', { dateStyle: 'medium' }) }}</small></div>
            </div>
            <span class="stars" :aria-label="`${review.rating} out of 5 stars`">{{ '★'.repeat(review.rating) }}</span>
            <p>“{{ review.text }}”</p>
            <div v-if="review.isOwn" class="card-actions">
              <button class="text-button" type="button" @click="beginEdit(review)">Edit</button>
              <button class="text-button danger" type="button" @click="removeReview(review.id)">Delete</button>
            </div>
          </article>
          <p v-if="!details.reviews.length" class="empty-note">No reviews yet. Be the first reader to leave a note.</p>
        </div>
      </section>

      <section class="clubs-section section-pad">
        <div class="page-shell">
          <p class="eyebrow">Read in good company</p>
          <h2>Book clubs reading<br /><em>this book.</em></h2>
          <div v-if="details.clubs.length" class="club-grid">
            <article v-for="club in details.clubs" :key="club.id" class="club-card">
              <span class="genre-pill">{{ club.selectionStatus }}</span>
              <h3>{{ club.name }}</h3>
              <p>{{ club.description }}</p>
              <RouterLink v-if="club.nextEvent" class="text-link" :to="{ name: 'event', params: { id: club.nextEvent.id } }">
                {{ club.nextEvent.title || 'Next event' }} →
              </RouterLink>
              <span v-else class="muted-note">Next gathering to be announced</span>
            </article>
          </div>
          <p v-else class="empty-note">No club has scheduled this title yet.</p>
        </div>
      </section>
    </template>
  </main>
</template>
