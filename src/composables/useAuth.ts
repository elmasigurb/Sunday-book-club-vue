import type { Session } from '@supabase/supabase-js'
import { readonly, ref } from 'vue'
import { unavailableInShowcaseMessage } from '../config'
import { supabase } from '../lib/supabase'

const session = ref<Session | null>(null)
const initializing = ref(true)
let started = false

export function initializeAuth() {
  if (started) return
  started = true

  if (!supabase) {
    initializing.value = false
    return
  }

  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) console.error('Could not restore authentication session', error)
    session.value = data.session
    initializing.value = false
  })

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    session.value = nextSession
    initializing.value = false
  })
}

export async function sendMagicLink(email: string) {
  if (!supabase) throw new Error(unavailableInShowcaseMessage)
  const redirectUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
  redirectUrl.hash = 'member-access'

  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: redirectUrl.toString(),
      shouldCreateUser: true,
    },
  })

  if (error) throw error
}

export async function signOut() {
  if (!supabase) return
  const { error } = await supabase.auth.signOut({ scope: 'local' })
  if (error) throw error
}

export function useAuth() {
  initializeAuth()
  return {
    session: readonly(session),
    initializing: readonly(initializing),
  }
}
