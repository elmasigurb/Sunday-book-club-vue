# Security audit

Audit date: 2026-10-19

## Scope

Vue client, direct Supabase browser access, Supabase Auth, PostgreSQL grants and
RLS, security-definer RPCs, database migrations, GitHub Pages configuration,
and the retained Express API.

## Implemented controls

- Passwordless Supabase email authentication using PKCE and single-use links.
- Persistent browser sessions with automatic token refresh and redirect-session detection.
- The browser uses only the public Supabase URL and publishable key. `DATABASE_URL`, database passwords and service-role keys are not bundled.
- Profile, shelf, review and RSVP ownership is derived from `auth.uid()`, not browser input.
- Database constraints prevent duplicate usernames, shelf entries, member/book reviews and meeting RSVPs.
- Row Level Security protects all nine user-facing tables. Public policies expose only published books, active clubs, scheduled/completed meetings and approved reviews.
- Authenticated users can update only their own profile, shelf and reviews.
- New and edited member reviews must have `approved = false`; owners can see their pending reviews, while anonymous users see only approved reviews.
- Direct RSVP table writes are revoked from browser roles. Narrow authenticated RPCs register or cancel, and the registration RPC locks the meeting row while checking capacity.
- Attendance confirmation columns remain unavailable to browser roles.
- Security-definer functions use an empty `search_path` and schema-qualified relations.
- The `book_catalog` view uses `security_invoker`, so underlying RLS remains effective.
- The retained Express API still uses verified bearer tokens, parameterized SQL, Zod validation, an explicit CORS allowlist, Helmet, request limits and rate limits if separately deployed.
- `.env` and `.env.local` are ignored and no environment files are tracked.

## Verified behavior

- Frontend and server compile with strict TypeScript settings.
- The production frontend build completes successfully.
- The database RLS audit passes for all nine application tables and verifies protected RPC execution, safe function search paths, the security-invoker catalogue view, and revoked RSVP/attendance writes.
- A public-key Supabase smoke test passes for the exact nested catalogue, homepage, club-selection and event-detail queries used by Vue.
- The same smoke test confirms anonymous users cannot read members, shelves or RSVPs and cannot execute member/registration RPCs.
- A rollback-only authenticated audit verifies profile resolution and updates,
  bookshelf writes, pending-review writes, event registration and event
  cancellation without retaining any test changes.
- Source inspection confirms there are no browser `fetch` calls, `/api` URLs, Express proxy settings or static-showcase branches.

Passwordless delivery and authenticated write flows still require a real inbox and
must be checked after the production Auth URLs are configured. They have not been
claimed as live-site verified.

## Remaining deployment actions

### Retained Express server: verify the PostgreSQL certificate

The active connection is encrypted, but the shared pooler's certificate chain is not trusted by the local Node trust store. Download the project root certificate from Supabase Database Settings and set `DATABASE_SSL_CA_FILE`. The backend will then use strict certificate verification.

### Retained Express server: use a least-privilege database role

The current Supabase connection uses the administrative `postgres` database role. Before a public production launch, create a dedicated backend login role with only the permissions required by the API routes and use its pooler connection string.

### Retained Express server: use a shared rate-limit store if scaled

The current in-memory limiter is suitable for one Node process. Multiple production instances should use a shared store such as Redis.

### Operational configuration

- Add exact local and production redirect URLs in Supabase Auth.
- Configure production SMTP and review Supabase's email rate limits.
- Restrict PostgreSQL network access to deployment egress addresses when the hosting platform provides stable addresses.
- Configure `TRUST_PROXY_HOPS` to the exact proxy count used by the host.
- Require MFA before adding any future administrator interface.
