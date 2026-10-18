import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ path: '.env.local' })
dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  DATABASE_SSL_CA_FILE: z.string().optional(),
  CLIENT_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
  VITE_SUPABASE_URL: z.string().url().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20).optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const message = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n')
  throw new Error(`Invalid server environment:\n${message}`)
}

const configuredSupabaseUrl = parsed.data.SUPABASE_URL ?? parsed.data.VITE_SUPABASE_URL
const supabasePublishableKey =
  parsed.data.SUPABASE_PUBLISHABLE_KEY ?? parsed.data.VITE_SUPABASE_PUBLISHABLE_KEY

if (!configuredSupabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for authentication',
  )
}

const supabaseUrl = new URL(configuredSupabaseUrl).origin

export const config = {
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  databaseSsl: parsed.data.DATABASE_SSL,
  databaseSslCaFile: parsed.data.DATABASE_SSL_CA_FILE,
  clientOrigins: parsed.data.CLIENT_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxyHops: parsed.data.TRUST_PROXY_HOPS,
  supabaseUrl,
  supabasePublishableKey,
}
