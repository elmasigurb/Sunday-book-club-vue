export const isStaticShowcase = import.meta.env.VITE_STATIC_MODE === 'true'

export const hasSupabaseConfig = Boolean(
  import.meta.env.VITE_SUPABASE_URL?.trim()
  && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim(),
)

export const unavailableInShowcaseMessage =
  'This action needs the live API. GitHub Pages is showing the read-only project showcase.'
