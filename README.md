# Sunday Book Club

A Vue 3 reading platform backed directly by Supabase Auth and PostgreSQL. The
existing TypeScript/Express API remains in the repository for compatibility and
administrative/server-side work, but the browser does not depend on it.

## Architecture

- `src/`: Vue/Vite frontend
- `server/`: retained Node.js/Express API for compatibility and server-side operations
- `supabase/migrations/`: ordered database migrations, constraints, indexes, seed content and RLS policies
- The Vue app uses the Supabase JavaScript SDK with the public project URL and
  publishable key. `DATABASE_URL` and elevated keys remain server-side only.

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

Authentication uses Supabase passwordless email links with PKCE. The browser
persists and refreshes its Supabase session, and Postgres uses that identity for
RLS. If the retained Node API is used separately, it still verifies bearer tokens
with Supabase Auth. Passwords are never collected or stored by this application.

In **Supabase → Authentication → URL Configuration**, set the production Site
URL to `https://elmasigurb.github.io/Sunday-book-club-vue/` and add this local
redirect URL:

```text
http://localhost:5173/Sunday-book-club-vue/
```

Add both the production Site URL and the local URL to the redirect allow list.
The default Magic Link template using `{{ .ConfirmationURL }}` is compatible
with the client-side PKCE callback. Configure custom SMTP for production email
delivery, then test a real email link on the deployed origin.

For full database TLS verification, download the root certificate from Supabase **Database Settings** and set `DATABASE_SSL_CA_FILE` to its path. Without it, traffic is encrypted but the server certificate cannot be verified.

## Development

Install dependencies:

```sh
npm install
```

Run the frontend and retained API together:

```sh
npm run dev
```

They can also be run separately for debugging:

```sh
npm run dev:server
npm run dev:web
```

The Vue application reads and writes through Supabase. Site content comes from
PostgreSQL; loading, empty and error states are shown when data is unavailable.

The Vue app uses hash routes such as `#/explore`, `#/books/:slug`, `#/profile`,
and `#/events/:id`. This preserves direct links and refreshes on GitHub Pages
without server rewrite rules. Browser features call Supabase directly; there is
no frontend `/api` proxy.

## Retained Express API

The existing API is kept for compatibility and possible administrative or
server-side use. The Vue application does not call these routes.

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
npm run security:client
npm run start:server
```

`CLIENT_ORIGINS` applies only if the retained Express server is deployed for a
separate use case. It is not required by the GitHub Pages application.

### GitHub Pages

GitHub Pages hosts the Vue bundle while Supabase provides authentication, data,
RLS authorization and transactional RPCs. Add `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` as GitHub Actions repository variables before
deploying. Hash-based routes keep direct links and refreshes compatible with Pages.
