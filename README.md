# Sunday Book Club

A Vue 3 frontend with a TypeScript/Express API and PostgreSQL hosted by Supabase.

## Architecture

- `src/`: Vue/Vite frontend
- `server/`: Node.js, Express, Zod validation and PostgreSQL API
- `supabase/migrations/`: ordered database migrations, constraints, indexes, seed content and RLS policies
- The Vue app only talks to `/api`; the PostgreSQL connection string remains server-side.

## Supabase setup

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Open **Connect** in the project dashboard and copy a Postgres connection string. For a long-running Node server, use the session pooler or direct connection. Replace the password placeholder with the database password.
3. Copy the environment template:

   ```sh
   cp .env.example .env
   ```

4. Set `DATABASE_URL` in `.env`. Never put it in a `VITE_` variable or commit `.env`.
5. Apply the schema and seed data:

   ```sh
   npm run db:migrate
   ```

The migration runner records applied files in `public.schema_migrations`, so rerunning it applies only new migrations. The reading-platform migration is additive: it preserves existing content and registrations, adds profiles, bookshelves, clubs/selections and confirmed attendance, and installs ownership-based RLS policies.

## Authentication

Authentication uses Supabase passwordless email links with PKCE. The browser receives a Supabase session, while protected Node endpoints independently verify its bearer token with Supabase Auth. Passwords are never collected or stored by this application.

In **Supabase → Authentication → URL Configuration**, set the production Site URL and add the local redirect URL:

```text
http://localhost:5173/Sunday-book-club-vue/
```

Add the deployed site URL as an allowed redirect before production. Configure custom SMTP for production email delivery.

For full database TLS verification, download the root certificate from Supabase **Database Settings** and set `DATABASE_SSL_CA_FILE` to its path. Without it, traffic is encrypted but the server certificate cannot be verified.

## Development

Install dependencies:

```sh
npm install
```

Run the frontend and API together:

```sh
npm run dev
```

They can also be run separately for debugging:

```sh
npm run dev:server
npm run dev:web
```

Vite proxies `/api` to `http://localhost:3000`. Site content comes from PostgreSQL; loading, empty and error states are shown when data is unavailable.

The Vue app uses history-mode routes for `/explore`, `/books/:slug`, `/profile`, and `/events/:id`. Production hosting must rewrite unknown frontend paths to `index.html` so direct links continue to work. Keep `/api/*` routed to the Node server rather than the SPA fallback.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Database health check |
| `GET` | `/api/content` | Published books, featured book, next meeting and approved reviews |
| `POST` | `/api/members` | Create or reactivate a club membership |
| `GET` | `/api/account` | Create/read the authenticated member profile |
| `POST` | `/api/meetings/:id/rsvp` | Reserve a seat; authentication required |
| `DELETE` | `/api/meetings/:id/rsvp` | Cancel the signed-in member's reservation |
| `GET` | `/api/books` | Search, filter and sort the published catalogue |
| `GET` | `/api/books/:slug` | Book details, community reviews and club selections |
| `PUT` | `/api/books/:id/reading-status` | Add or update the signed-in member's shelf status |
| `DELETE` | `/api/books/:id/reading-status` | Remove a book from the signed-in member's shelf |
| `POST` | `/api/books/:id/reviews` | Write one review for a book |
| `PATCH` | `/api/reviews/:id` | Edit the signed-in member's review |
| `DELETE` | `/api/reviews/:id` | Delete the signed-in member's review |
| `GET` | `/api/profile` | Profile, statistics, events, bookshelf and reviews |
| `PATCH` | `/api/profile` | Update the signed-in member's public profile fields |
| `GET` | `/api/events/:id` | Event, featured book, club and registration details |

Example membership request:

```json
{
  "name": "Elín",
  "email": "elin@example.com"
}
```

## Production

```sh
npm run typecheck
npm run build
npm run build:server
npm run security:rls
npm run start:server
```

Set `CLIENT_ORIGINS` to the deployed frontend URL. If the frontend and API are deployed separately, set `VITE_API_URL` to the API base URL before building Vue, for example `https://api.example.com/api`.
