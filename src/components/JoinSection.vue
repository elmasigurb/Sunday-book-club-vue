<script setup lang="ts">
import { ref } from 'vue'
import { joinClub } from '../api'

const name = ref('')
const email = ref('')
const joined = ref(false)
const submitting = ref(false)
const errorMessage = ref('')

async function submitForm() {
  if (!name.value.trim() || !email.value.trim()) return
  submitting.value = true
  errorMessage.value = ''

  try {
    await joinClub(name.value.trim(), email.value.trim())
    joined.value = true
  } catch (error) {
    errorMessage.value = error instanceof Error
      ? error.message
      : 'We could not save your membership. Please try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <section id="join" class="join-section section-pad">
    <div class="join-flower flower-left" aria-hidden="true"><i></i></div>
    <div class="join-flower flower-right" aria-hidden="true"><i></i></div>
    <div class="page-shell join-inner">
      <p class="eyebrow">Good stories start here</p>
      <h2>Your next favourite<br />book is <em>waiting.</em></h2>
      <p>Join Sunday Book Club for monthly reads, cozy meetups and very strong opinions about fictional people.</p>

      <form v-if="!joined" class="join-form" @submit.prevent="submitForm">
        <label><span>Your name</span><input v-model="name" name="name" autocomplete="name" placeholder="e.g. Elín" required /></label>
        <label><span>Email address</span><input v-model="email" type="email" name="email" autocomplete="email" placeholder="you@email.com" required /></label>
        <button class="button button-burgundy" type="submit" :disabled="submitting">{{ submitting ? 'Joining…' : 'Join the Club' }} <span v-if="!submitting" aria-hidden="true">→</span></button>
        <p v-if="errorMessage" class="form-error" role="alert">{{ errorMessage }}</p>
      </form>
      <div v-else class="success-message" role="status">
        <span aria-hidden="true">✿</span>
        <div><strong>Welcome to the club, {{ name }}!</strong><p>Check your inbox—your first Sunday read is on its way.</p></div>
      </div>
      <small class="fine-print">One lovely email a month. No spam, no plot spoilers.</small>
    </div>
  </section>
</template>
