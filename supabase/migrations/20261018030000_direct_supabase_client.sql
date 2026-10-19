-- Prepare the existing schema for a browser-only Supabase client.
-- This migration is additive and does not delete application data.

-- Resolve the application member that belongs to the current Auth user.
-- Keep this helper out of the caller's search path and qualify every relation.
create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id
  from public.members as m
  where m.auth_user_id = (select auth.uid())
  limit 1
$$;

revoke all on function public.current_member_id() from public, anon;
grant execute on function public.current_member_id() to authenticated;

-- Create or link the signed-in user's member profile. This replaces the
-- Express ensureMember helper for browser clients without granting direct
-- INSERT access on public.members.
create or replace function public.ensure_member_profile()
returns table (
  member_id uuid,
  member_name text,
  member_email text,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id uuid := (select auth.uid());
  auth_email public.citext;
  auth_name text;
  username_base text;
  generated_username text;
  member_row public.members%rowtype;
begin
  if auth_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select
    lower(u.email)::public.citext,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(regexp_replace(split_part(u.email, '@', 1), '[._-]+', ' ', 'g')), ''),
      'Book club member'
    )
  into auth_email, auth_name
  from auth.users as u
  where u.id = auth_user_id;

  if auth_email is null then
    raise exception 'The authenticated account has no email address'
      using errcode = '22023';
  end if;

  auth_name := left(auth_name, 100);
  if char_length(auth_name) < 2 then
    auth_name := 'Book club member';
  end if;

  username_base := trim(both '-' from regexp_replace(lower(auth_name), '[^a-z0-9]+', '-', 'g'));
  username_base := left(coalesce(nullif(username_base, ''), 'reader'), 36);
  generated_username := username_base || '-' || left(replace(auth_user_id::text, '-', ''), 6);

  select m.*
  into member_row
  from public.members as m
  where m.auth_user_id = auth_user_id
  for update;

  if found then
    update public.members as m
    set email = auth_email,
        name = auth_name,
        display_name = coalesce(nullif(m.display_name, ''), auth_name),
        subscribed = true,
        updated_at = now()
    where m.id = member_row.id
    returning m.* into member_row;
  else
    select m.*
    into member_row
    from public.members as m
    where m.email = auth_email
    for update;

    if found then
      if member_row.auth_user_id is not null and member_row.auth_user_id <> auth_user_id then
        raise exception 'This email is already linked to another account'
          using errcode = '23505';
      end if;

      update public.members as m
      set auth_user_id = auth_user_id,
          name = auth_name,
          display_name = coalesce(nullif(m.display_name, ''), auth_name),
          username = coalesce(nullif(m.username::text, ''), generated_username)::public.citext,
          subscribed = true,
          updated_at = now()
      where m.id = member_row.id
      returning m.* into member_row;
    else
      insert into public.members (
        auth_user_id,
        name,
        email,
        username,
        display_name,
        subscribed
      )
      values (
        auth_user_id,
        auth_name,
        auth_email,
        generated_username,
        auth_name,
        true
      )
      returning * into member_row;
    end if;
  end if;

  return query
  select
    member_row.id,
    member_row.name,
    member_row.email::text,
    member_row.username::text,
    member_row.display_name,
    member_row.bio,
    member_row.avatar_url,
    member_row.created_at;
end;
$$;

revoke all on function public.ensure_member_profile() from public, anon;
grant execute on function public.ensure_member_profile() to authenticated;

-- A read-only catalogue shape preserves the API's community rating and review
-- count without giving the browser access to unpublished books or unapproved
-- reviews. security_invoker keeps the underlying table RLS policies active.
create or replace view public.book_catalog
with (security_invoker = true)
as
select
  b.id,
  b.slug,
  b.title,
  b.author,
  b.genre,
  coalesce(round(avg(r.rating)::numeric, 1), b.rating) as rating,
  count(r.id)::integer as review_count,
  b.cover_class,
  b.cover_kicker,
  b.cover_image_url,
  b.featured,
  b.description,
  b.pages,
  b.publication_year,
  b.pull_quote,
  b.display_order,
  b.created_at
from public.books as b
left join public.reviews as r
  on r.book_id = b.id
 and r.approved = true
where b.published = true
group by b.id;

revoke all on table public.book_catalog from public, anon, authenticated;
grant select on table public.book_catalog to anon, authenticated;

-- Separate public and owner review reads so anonymous requests never need to
-- execute the authenticated-only current_member_id helper.
drop policy if exists reviews_public_or_own_read on public.reviews;
drop policy if exists reviews_public_read on public.reviews;
drop policy if exists reviews_own_read on public.reviews;

create policy reviews_public_read
  on public.reviews
  for select
  to anon, authenticated
  using (approved = true);

create policy reviews_own_read
  on public.reviews
  for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and member_id = (select public.current_member_id())
  );

-- Safer moderation: member-created or member-edited reviews are pending until
-- an organizer approves them. Owners can still read, edit, and delete drafts.
drop policy if exists reviews_own_insert on public.reviews;
create policy reviews_own_insert
  on public.reviews
  for insert
  to authenticated
  with check (
    (select auth.uid()) is not null
    and member_id = (select public.current_member_id())
    and approved = false
  );

drop policy if exists reviews_own_update on public.reviews;
create policy reviews_own_update
  on public.reviews
  for update
  to authenticated
  using (
    (select auth.uid()) is not null
    and member_id = (select public.current_member_id())
  )
  with check (
    member_id = (select public.current_member_id())
    and approved = false
  );

drop policy if exists reviews_own_delete on public.reviews;
create policy reviews_own_delete
  on public.reviews
  for delete
  to authenticated
  using (
    (select auth.uid()) is not null
    and member_id = (select public.current_member_id())
  );

-- Register the current member atomically. The meeting row lock serializes the
-- capacity check so concurrent browser requests cannot overbook the event.
create or replace function public.register_for_meeting(p_meeting_id uuid)
returns table (registration_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id uuid := (select auth.uid());
  current_member uuid;
  meeting_capacity integer;
  attending_count integer;
  next_status text;
begin
  if auth_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select profile.member_id
  into current_member
  from public.ensure_member_profile() as profile;

  select m.capacity
  into meeting_capacity
  from public.meetings as m
  where m.id = p_meeting_id
    and m.status = 'scheduled'
    and m.ends_at > now()
  for update;

  if not found then
    raise exception 'This meeting is not available' using errcode = 'P0002';
  end if;

  select count(*)::integer
  into attending_count
  from public.rsvps as r
  where r.meeting_id = p_meeting_id
    and r.status = 'attending'
    and r.member_id <> current_member;

  next_status := case
    when meeting_capacity is not null and attending_count >= meeting_capacity
      then 'waitlisted'
    else 'attending'
  end;

  insert into public.rsvps as r (
    member_id,
    meeting_id,
    status,
    attendance_status,
    attendance_confirmed_at,
    attendance_confirmed_by
  )
  values (
    current_member,
    p_meeting_id,
    next_status,
    'registered',
    null,
    null
  )
  on conflict (member_id, meeting_id) do update
    set status = excluded.status,
        attendance_status = 'registered',
        attendance_confirmed_at = null,
        attendance_confirmed_by = null,
        updated_at = now();

  return query select next_status;
end;
$$;

revoke all on function public.register_for_meeting(uuid) from public, anon;
grant execute on function public.register_for_meeting(uuid) to authenticated;

create or replace function public.cancel_meeting_registration(p_meeting_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  auth_user_id uuid := (select auth.uid());
  current_member uuid;
begin
  if auth_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  current_member := (select public.current_member_id());
  if current_member is null then
    raise exception 'Member profile not found' using errcode = 'P0002';
  end if;

  update public.rsvps as r
  set status = 'cancelled',
      updated_at = now()
  where r.member_id = current_member
    and r.meeting_id = p_meeting_id;
end;
$$;

revoke all on function public.cancel_meeting_registration(uuid) from public, anon;
grant execute on function public.cancel_meeting_registration(uuid) to authenticated;

-- Browser roles keep read-only access to their own RSVP row. All registration
-- writes go through the two narrowly scoped functions above; attendance remains
-- organizer/backend controlled.
drop policy if exists rsvps_own_insert on public.rsvps;
drop policy if exists rsvps_own_status_update on public.rsvps;
drop policy if exists rsvps_own_delete on public.rsvps;

revoke insert, update, delete on public.rsvps from anon, authenticated;
grant select on public.rsvps to authenticated;
