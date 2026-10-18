-- Additive expansion for profiles, personal shelves, reviews, clubs, and attendance.
-- Existing content and registrations are preserved.

alter table public.members
  add column if not exists username citext,
  add column if not exists display_name text,
  add column if not exists bio text,
  add column if not exists avatar_url text;

update public.members
set display_name = coalesce(display_name, name),
    username = coalesce(
      username,
      left(regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'), 36)
        || '-' || left(replace(id::text, '-', ''), 6)
    )
where display_name is null or username is null;

alter table public.members
  alter column display_name set not null,
  alter column username set not null;

alter table public.members
  drop constraint if exists members_username_length,
  add constraint members_username_length check (char_length(username::text) between 3 and 50),
  drop constraint if exists members_display_name_length,
  add constraint members_display_name_length check (char_length(display_name) between 2 and 100),
  drop constraint if exists members_bio_length,
  add constraint members_bio_length check (bio is null or char_length(bio) <= 500),
  drop constraint if exists members_avatar_url_length,
  add constraint members_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 1000);

create unique index if not exists members_username_unique_idx on public.members(username);
create index if not exists members_auth_user_id_idx on public.members(auth_user_id);

alter table public.books
  add column if not exists cover_image_url text,
  add column if not exists isbn text;

alter table public.books
  drop constraint if exists books_cover_image_url_length,
  add constraint books_cover_image_url_length check (cover_image_url is null or char_length(cover_image_url) <= 1000);

create table if not exists public.reading_lists (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  status text not null check (status in ('want_to_read', 'currently_reading', 'read')),
  started_at date,
  finished_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, book_id),
  check (finished_at is null or started_at is null or finished_at >= started_at)
);

create table if not exists public.book_clubs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null check (char_length(name) between 2 and 120),
  description text not null check (char_length(description) between 10 and 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.book_club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.book_clubs(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'organizer', 'admin')),
  status text not null default 'active' check (status in ('active', 'invited', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, member_id)
);

alter table public.meetings
  add column if not exists club_id uuid references public.book_clubs(id) on delete set null,
  add column if not exists title text,
  add column if not exists description text;

create table if not exists public.book_club_selections (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.book_clubs(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  meeting_id uuid references public.meetings(id) on delete set null,
  status text not null default 'planned' check (status in ('planned', 'current', 'completed')),
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, book_id, meeting_id),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

alter table public.rsvps
  add column if not exists attendance_status text not null default 'registered',
  add column if not exists attendance_confirmed_at timestamptz,
  add column if not exists attendance_confirmed_by uuid references auth.users(id) on delete set null;

alter table public.rsvps
  drop constraint if exists rsvps_attendance_status_check,
  add constraint rsvps_attendance_status_check
    check (attendance_status in ('registered', 'confirmed', 'no_show')),
  drop constraint if exists rsvps_attendance_confirmation_check,
  add constraint rsvps_attendance_confirmation_check check (
    (attendance_status = 'confirmed' and attendance_confirmed_at is not null)
    or (attendance_status <> 'confirmed')
  );

create unique index if not exists reviews_one_per_member_book_idx
  on public.reviews(member_id, book_id)
  where member_id is not null;
create index if not exists reading_lists_member_status_idx on public.reading_lists(member_id, status);
create index if not exists reading_lists_book_id_idx on public.reading_lists(book_id);
create index if not exists book_club_memberships_member_idx on public.book_club_memberships(member_id);
create index if not exists book_club_selections_book_idx on public.book_club_selections(book_id, status);
create index if not exists book_club_selections_club_idx on public.book_club_selections(club_id, status);
create index if not exists meetings_club_idx on public.meetings(club_id, starts_at);
create index if not exists rsvps_attendance_idx on public.rsvps(member_id, attendance_status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'books', 'members', 'meetings', 'rsvps', 'reviews', 'reading_lists',
    'book_clubs', 'book_club_memberships', 'book_club_selections'
  ] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.members where auth_user_id = auth.uid() limit 1
$$;

revoke all on function public.current_member_id() from public;
grant execute on function public.current_member_id() to authenticated;

alter table public.reading_lists enable row level security;
alter table public.book_clubs enable row level security;
alter table public.book_club_memberships enable row level security;
alter table public.book_club_selections enable row level security;

drop policy if exists books_public_read on public.books;
create policy books_public_read on public.books for select
  using (published = true);

drop policy if exists meetings_public_read on public.meetings;
create policy meetings_public_read on public.meetings for select
  using (status in ('scheduled', 'completed'));

drop policy if exists clubs_public_read on public.book_clubs;
create policy clubs_public_read on public.book_clubs for select
  using (active = true);

drop policy if exists club_selections_public_read on public.book_club_selections;
create policy club_selections_public_read on public.book_club_selections for select
  using (exists (
    select 1 from public.book_clubs c where c.id = club_id and c.active = true
  ));

drop policy if exists reviews_public_or_own_read on public.reviews;
create policy reviews_public_or_own_read on public.reviews for select
  using (approved = true or member_id = public.current_member_id());

drop policy if exists reviews_own_insert on public.reviews;
create policy reviews_own_insert on public.reviews for insert to authenticated
  with check (member_id = public.current_member_id() and approved = false);

drop policy if exists reviews_own_update on public.reviews;
create policy reviews_own_update on public.reviews for update to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id() and approved = false);

drop policy if exists reviews_own_delete on public.reviews;
create policy reviews_own_delete on public.reviews for delete to authenticated
  using (member_id = public.current_member_id());

drop policy if exists members_own_read on public.members;
create policy members_own_read on public.members for select to authenticated
  using (auth_user_id = auth.uid());

drop policy if exists members_own_update on public.members;
create policy members_own_update on public.members for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists reading_lists_own_all on public.reading_lists;
create policy reading_lists_own_all on public.reading_lists for all to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());

drop policy if exists memberships_own_read on public.book_club_memberships;
create policy memberships_own_read on public.book_club_memberships for select to authenticated
  using (member_id = public.current_member_id());

drop policy if exists rsvps_own_read on public.rsvps;
create policy rsvps_own_read on public.rsvps for select to authenticated
  using (member_id = public.current_member_id());

drop policy if exists rsvps_own_insert on public.rsvps;
create policy rsvps_own_insert on public.rsvps for insert to authenticated
  with check (
    member_id = public.current_member_id()
    and attendance_status = 'registered'
    and attendance_confirmed_at is null
    and attendance_confirmed_by is null
  );

drop policy if exists rsvps_own_status_update on public.rsvps;
create policy rsvps_own_status_update on public.rsvps for update to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());

drop policy if exists rsvps_own_delete on public.rsvps;
create policy rsvps_own_delete on public.rsvps for delete to authenticated
  using (member_id = public.current_member_id());

revoke all on public.books, public.members, public.meetings, public.rsvps, public.reviews,
  public.reading_lists, public.book_clubs, public.book_club_memberships,
  public.book_club_selections from anon, authenticated;

grant select on public.books, public.meetings, public.reviews, public.book_clubs,
  public.book_club_selections to anon, authenticated;
grant select, update(username, display_name, bio, avatar_url) on public.members to authenticated;
grant select, insert, update, delete on public.reading_lists to authenticated;
grant insert(member_id, book_id, display_name, initials, quote, rating, color, approved),
  update(display_name, initials, quote, rating, color, approved), delete on public.reviews to authenticated;
grant select on public.book_club_memberships to authenticated;
grant select, delete on public.rsvps to authenticated;
grant insert(member_id, meeting_id, status), update(status) on public.rsvps to authenticated;

insert into public.book_clubs (slug, name, description)
values (
  'sunday-book-club',
  'Sunday Book Club',
  'A warm Reykjavík reading community for thoughtful books, generous conversation, coffee, and cake.'
)
on conflict (slug) do nothing;

update public.meetings m
set club_id = c.id,
    title = coalesce(m.title, 'Sunday Book Club Meeting'),
    description = coalesce(m.description, m.note)
from public.book_clubs c
where c.slug = 'sunday-book-club' and m.club_id is null;

insert into public.book_club_selections (club_id, book_id, meeting_id, status, starts_on)
select c.id, m.book_id, m.id,
       case when m.ends_at < now() then 'completed' else 'current' end,
       m.starts_at::date
from public.meetings m
join public.book_clubs c on c.id = m.club_id
where not exists (
  select 1 from public.book_club_selections s where s.meeting_id = m.id
);

update public.books
set description = case slug
  when 'apricot-skies' then 'Two old friends meet again during one luminous summer and must decide whether timing is fate or simply another story we tell ourselves.'
  when 'the-green-room' then 'Behind the velvet curtain of a fading theatre, five performers rehearse a final production while the lives they avoid begin to take centre stage.'
  when 'salt-and-honey' then 'A tender memoir of kitchens, coastlines, family recipes, and the complicated inheritance held inside the food we remember.'
  when 'after-the-sun' then 'Stories of small endings and unexpected beginnings, following people who step into the long evening light and return subtly changed.'
  else description
end,
publication_year = coalesce(publication_year, case slug
  when 'apricot-skies' then 2024
  when 'the-green-room' then 2023
  when 'salt-and-honey' then 2025
  when 'after-the-sun' then 2022
end)
where description is null or publication_year is null;
