# Sunday Book Club

Sunday Book Club is an interactive reading-community website built with Vue 3,
TypeScript and Supabase. Members can discover books, keep a personal bookshelf,
write reviews, join book clubs, register for meetings and view their attendance
history.

- [Visit the live website](https://elmasigurb.github.io/Sunday-book-club-vue/)
- [Read the interactive development and decision report](https://elmasigurb.github.io/Sunday-book-club-vue/development-report.html)

The development report explains the project's major design and engineering
decisions, the Supabase migration, security model, technical challenges, and how
adding a backend changed the website's UX and UI.

## Main features

- Passwordless member sign-in with persistent Supabase Auth sessions
- Searchable and filterable book catalogue
- Individual book and event pages
- Personal reading statuses and bookshelf
- Member reviews with a safe moderation workflow
- Book clubs, meeting registration, cancellation and waitlisting
- Member profiles, reading statistics and attendance history
- Responsive layouts with loading, empty, success and error states

## Technology

- **Frontend:** Vue 3, TypeScript, Vite and Vue Router
- **Authentication:** Supabase Auth with passwordless email links and PKCE
- **Database:** Supabase PostgreSQL
- **Security:** Row Level Security policies and narrowly scoped database functions
- **Hosting:** GitHub Pages, deployed through GitHub Actions

The browser communicates directly with Supabase using the public project URL
and publishable key. PostgreSQL Row Level Security controls which records each
member can read or change. Database passwords and service-role keys are never
included in the frontend.

The original Express API remains in [`server/`](server/) for compatibility and
possible administrative or server-side work, but the deployed website does not
depend on it.

## Project structure

| Path | Purpose |
| --- | --- |
| [`src/`](src/) | Vue application, pages, components and Supabase data access |
| [`supabase/migrations/`](supabase/migrations/) | Additive database migrations, functions and RLS policies |
| [`server/`](server/) | Retained Express API and database/security scripts |
| [`development-report.html`](development-report.html) | Interactive development and decision report |
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | GitHub Pages build and deployment workflow |

## Run locally

Install the dependencies and start the Vue development server:

```sh
npm install
npm run dev:web
```

Create a local `.env` file from [`.env.example`](.env.example) and provide the
required Supabase configuration. Never commit `.env`, a database password,
`DATABASE_URL`, or a service-role key.

Useful verification commands:

```sh
npm run typecheck
npm run build
npm run security:rls
npm run security:client
npm run security:member-flows
```

The production build contains both the main application and the standalone
development report. Vite's GitHub Pages base path is
`/Sunday-book-club-vue/`.
