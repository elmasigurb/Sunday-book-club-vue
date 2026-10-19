import type { Session } from '@supabase/supabase-js'
import { readonly, ref } from 'vue'
import { authRedirectUrl } from '../config'
import { ensureMemberProfile } from '../lib/member'
import { supabase } from '../lib/supabase'

const session = ref<Session | null>(null)
const initializing = ref(true)
let started = false

export function initializeAuth() {
  if (started) return
  started = true

  void supabase.auth.getSession().then(({ data, error }) => {
    if (error) console.error('Could not restore authentication session', error)
    session.value = data.session
    if (data.session) void ensureMemberProfile().catch((profileError) => {
      console.error('Could not sync the member profile', profileError)
    })
    initializing.value = false
  })

  supabase.auth.onAuthStateChange((_event, nextSession) => {
    session.value = nextSession
    initializing.value = false
    if (nextSession) {
      window.setTimeout(() => {
        void ensureMemberProfile().catch((profileError) => {
          console.error('Could not sync the member profile', profileError)
        })
      }, 0)
    }
  })
}

export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      emailRedirectTo: authRedirectUrl(),
      shouldCreateUser: true,
    },
  })

  if (error) throw error
}

export async function signOut() {
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
