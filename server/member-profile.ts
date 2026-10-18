import type { PoolClient, QueryResultRow } from 'pg'
import type { User } from '@supabase/supabase-js'

interface MemberRow extends QueryResultRow {
  id: string
  name: string
  email: string
  username?: string
  display_name?: string
  bio?: string | null
  avatar_url?: string | null
  created_at?: Date
}

function memberName(user: User) {
  const metadataName = user.user_metadata.full_name ?? user.user_metadata.name
  if (typeof metadataName === 'string' && metadataName.trim().length >= 2) {
    return metadataName.trim().slice(0, 100)
  }

  const emailName = user.email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  return emailName && emailName.length >= 2 ? emailName.slice(0, 100) : 'Book club member'
}

export async function ensureMember(client: PoolClient, user: User): Promise<MemberRow> {
  const email = user.email!.toLowerCase()
  const name = memberName(user)
  const usernameBase = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36) || 'reader'
  const username = `${usernameBase}-${user.id.replaceAll('-', '').slice(0, 6)}`

  const existingAuth = await client.query<MemberRow>(
    `
      update public.members
      set email = $2, name = $3, subscribed = true, updated_at = now()
      where auth_user_id = $1
      returning id, name, email, username, display_name, bio, avatar_url, created_at
    `,
    [user.id, email, name],
  )
  if (existingAuth.rows[0]) return existingAuth.rows[0]

  const byEmail = await client.query<MemberRow>(
    `
      insert into public.members
        (auth_user_id, name, email, username, display_name, subscribed)
      values ($1, $2, $3, $4, $2, true)
      on conflict (email) do update
        set auth_user_id = excluded.auth_user_id,
            name = excluded.name,
            subscribed = true,
            updated_at = now()
        where members.auth_user_id is null or members.auth_user_id = excluded.auth_user_id
      returning id, name, email, username, display_name, bio, avatar_url, created_at
    `,
    [user.id, name, email, username],
  )

  if (!byEmail.rows[0]) {
    throw new Error('This email is already linked to another account')
  }
  return byEmail.rows[0]
}
