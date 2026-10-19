import { supabase } from './supabase'

export interface MemberProfileRow {
  member_id: string
  member_name: string
  member_email: string
  username: string
  display_name: string
  bio: string | null
  avatar_url: string | null
  created_at: string
}

export async function ensureMemberProfile(): Promise<MemberProfileRow> {
  const { data, error } = await supabase.rpc('ensure_member_profile')
  if (error) throw error

  const member = (data as MemberProfileRow[] | null)?.[0]
  if (!member) throw new Error('Member profile could not be created')
  return member
}
