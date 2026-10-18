import pg from 'pg'
import { readFileSync } from 'node:fs'
import { config } from './config.js'

const { Pool } = pg

const ssl = config.databaseSsl
  ? config.databaseSslCaFile
    ? {
        ca: readFileSync(config.databaseSslCaFile, 'utf8'),
        rejectUnauthorized: true,
      }
    : { rejectUnauthorized: false }
  : false

if (config.databaseSsl && !config.databaseSslCaFile) {
  console.warn(
    'Database traffic is encrypted, but the server certificate is not verified. Set DATABASE_SSL_CA_FILE for production.',
  )
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error', error)
})

export async function closeDatabase() {
  await pool.end()
}
