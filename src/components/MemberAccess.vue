<script setup lang="ts">
import { ref } from 'vue'
import { getAccount } from '../api'
import { isStaticShowcase } from '../config'
import { sendMagicLink, signOut, useAuth } from '../composables/useAuth'

const { session, initializing } = useAuth()
const email = ref('')
const pending = ref(false)
const message = ref('')
const errorMessage = ref('')

async function requestLink() {
  pending.value = true
  message.value = ''
  errorMessage.value = ''

  try {
    await sendMagicLink(email.value)
    message.value = 'Check your inbox for a secure sign-in link.'
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not send the sign-in link.'
  } finally {
    pending.value = false
  }
}

async function syncAccount() {
  try {
    await getAccount()
  } catch (error) {
    console.error('Could not sync the member profile', error)
  }
}

async function logOut() {
  errorMessage.value = ''
  try {
    await signOut()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Could not sign out.'
  }
}
</script>

<template>
  <section id="member-access" class="member-access section-pad">
    <div class="page-shell member-access-inner">
      <div>
        <p class="eyebrow">Members only</p>
        <h2>Your club<br /><em>account.</em></h2>
        <p>Sign in without a password to reserve a seat at our next meeting.</p>
      </div>

      <div class="member-access-card">
        <template v-if="isStaticShowcase">
          <span class="member-access-flower" aria-hidden="true">✿</span>
          <p class="eyebrow">Read-only showcase</p>
          <h3>The member area needs a live server.</h3>
          <p>You can explore every public page here. Sign-in, personal shelves, reviews and RSVPs are available when the Express API is deployed.</p>
        </template>

        <p v-else-if="initializing">Checking your session…</p>

        <template v-else-if="session">
          <span class="member-access-flower" aria-hidden="true">✿</span>
          <p class="eyebrow">Signed in</p>
          <h3>Welcome back.</h3>
          <p>{{ session.user.email }}</p>
          <div class="member-access-actions">
            <RouterLink class="button button-orange" :to="{ name: 'profile' }" @click="syncAccount">My Reading Corner</RouterLink>
            <button class="text-button" type="button" @click="logOut">Sign out</button>
          </div>
        </template>

        <form v-else @submit.prevent="requestLink">
          <label for="member-email">Email address</label>
          <input id="member-email" v-model="email" type="email" autocomplete="email" required placeholder="you@email.com" />
          <button class="button button-burgundy" type="submit" :disabled="pending">
            {{ pending ? 'Sending…' : 'Email me a sign-in link' }}
          </button>
          <p class="auth-help">The link is single-use. No password is stored by this website.</p>
        </form>

        <p v-if="message" class="auth-success" role="status">{{ message }}</p>
        <p v-if="errorMessage" class="form-error auth-error" role="alert">{{ errorMessage }}</p>
      </div>
    </div>
  </section>
</template>
