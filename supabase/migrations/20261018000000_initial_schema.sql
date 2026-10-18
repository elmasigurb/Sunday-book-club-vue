create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author text not null,
  genre text not null,
  rating numeric(2, 1) not null default 0 check (rating between 0 and 5),
  cover_class text not null default 'cover-apricot',
  cover_kicker text,
  featured boolean not null default false,
  description text,
  pages integer check (pages is null or pages > 0),
  publication_year integer,
  pull_quote text,
  display_order integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_featured_book
  on public.books (featured)
  where featured = true;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null check (char_length(name) between 2 and 100),
  email citext not null unique,
  subscribed boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text not null,
  note text,
  capacity integer check (capacity is null or capacity > 0),
  status text not null default 'scheduled'
    check (status in ('draft', 'scheduled', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  status text not null default 'attending'
    check (status in ('attending', 'waitlisted', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, meeting_id)
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete set null,
  book_id uuid not null references public.books(id) on delete cascade,
  display_name text not null,
  initials text not null check (char_length(initials) between 1 and 4),
  quote text not null check (char_length(quote) between 10 and 1000),
  rating smallint not null check (rating between 1 and 5),
  color text not null default 'pink' check (color in ('pink', 'orange', 'lime')),
  approved boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists meetings_starts_at_idx on public.meetings(starts_at);
create index if not exists rsvps_member_id_idx on public.rsvps(member_id);
create index if not exists rsvps_meeting_id_idx on public.rsvps(meeting_id);
create index if not exists reviews_book_id_idx on public.reviews(book_id);
create index if not exists reviews_member_id_idx on public.reviews(member_id);

alter table public.books enable row level security;
alter table public.members enable row level security;
alter table public.meetings enable row level security;
alter table public.rsvps enable row level security;
alter table public.reviews enable row level security;

revoke all on public.books, public.members, public.meetings, public.rsvps, public.reviews
  from anon, authenticated;

insert into public.books
  (slug, title, author, genre, rating, cover_class, cover_kicker, featured,
   description, pages, publication_year, pull_quote, display_order)
values
  ('the-sunday-chapter', 'The Sunday Chapter', 'June Harper', 'Literary fiction', 5.0,
   'cover-featured', 'A Novel', true,
   'When three strangers inherit a tiny bookshop on the edge of Reykjavík, they discover a pencilled note inside every book—and a story that might connect them all.',
   304, 2026, 'Warm, strange and impossible to put down.', 0),
  ('apricot-skies', 'Apricot Skies', 'Mara Vale', 'Romance', 4.8,
   'cover-apricot', 'A love story', false, null, null, null, null, 1),
  ('the-green-room', 'The Green Room', 'Elliot Pine', 'Literary fiction', 4.6,
   'cover-green', null, false, null, null, null, null, 2),
  ('salt-and-honey', 'Salt & Honey', 'Nora Bell', 'Memoir', 4.9,
   'cover-salt', 'A memoir', false, null, null, null, null, 3),
  ('after-the-sun', 'After the Sun', 'Leonie Hart', 'Short stories', 4.7,
   'cover-sun', 'Stories', false, null, null, null, null, 4)
on conflict (slug) do nothing;

insert into public.meetings (book_id, starts_at, ends_at, location, note, capacity, status)
select id, '2026-11-15 14:00:00+00', '2026-11-15 16:00:00+00',
       'Sunday Studio, Reykjavík', 'Coffee, cake & good conversation included', 40, 'scheduled'
from public.books
where slug = 'the-sunday-chapter'
  and not exists (
    select 1 from public.meetings where starts_at = '2026-11-15 14:00:00+00'
  );

insert into public.reviews
  (book_id, display_name, initials, quote, rating, color, approved, display_order)
select b.id, seed.display_name, seed.initials, seed.quote, 5, seed.color, true, seed.display_order
from (
  values
    ('apricot-skies', 'Anna', 'AM', 'I joined for the books and stayed for the people—and the truly excellent Sunday cake.', 'pink', 1),
    ('the-green-room', 'Sara', 'SK', 'My favourite Sunday of every month. The kind of conversation that follows you home.', 'lime', 2),
    ('salt-and-honey', 'Elín', 'EJ', 'It has completely changed how I read. Every book feels bigger when we unpack it together.', 'orange', 3)
) as seed(book_slug, display_name, initials, quote, color, display_order)
join public.books b on b.slug = seed.book_slug
where not exists (
  select 1 from public.reviews r
  where r.book_id = b.id and r.display_name = seed.display_name
);
