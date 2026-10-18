import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../db.js'

const migrationsDirectory = dirname(
  fileURLToPath(new URL('../../supabase/migrations/.keep', import.meta.url)),
)

async function migrate() {
  const client = await pool.connect()

  try {
    await client.query(`
      create table if not exists public.schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `)

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const applied = await client.query(
        'select 1 from public.schema_migrations where name = $1',
        [file],
      )
      if (applied.rowCount) continue

      const sql = await readFile(join(migrationsDirectory, file), 'utf8')
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query('insert into public.schema_migrations (name) values ($1)', [file])
        await client.query('commit')
        console.log(`Applied ${file}`)
      } catch (error) {
        await client.query('rollback')
        throw error
      }
    }

    console.log('Database migrations are up to date')
  } finally {
    client.release()
    await pool.end()
  }
}

migrate().catch((error) => {
  console.error('Database migration failed', error)
  process.exit(1)
})
