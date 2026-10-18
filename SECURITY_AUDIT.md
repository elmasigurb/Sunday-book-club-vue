# Security audit

Audit date: 2026-10-18

## Scope

Vue client, Express API, Supabase Auth integration, PostgreSQL access, database migration, dependencies, environment handling and local HTTP behavior.

## Implemented controls

- Passwordless Supabase email authentication using PKCE and single-use links.
- Server-side bearer-token verification with `supabase.auth.getUser`; client claims are never trusted directly.
- Profile, shelf, review and RSVP endpoints reject missing, expired and forged tokens.
- Profile, shelf, review and RSVP ownership is derived from the verified Supabase user ID, not request input.
- Parameterized SQL and Zod validation are used for all user-controlled API input.
- Database constraints prevent duplicate usernames, shelf entries, member/book reviews and meeting RSVPs.
- Row Level Security protects all nine user-facing tables. Public policies expose only published books, active clubs, scheduled/completed meetings and approved reviews.
- Authenticated users can update only their own profile, shelf, reviews and registration state.
- Direct RSVP writes are not granted to browser roles, preventing capacity bypasses through PostgREST. Only the authenticated API can change a registration; only a trusted organizer/backend path can confirm attendance.
- CORS uses an explicit origin allowlist and rejects other browser origins.
- Helmet security headers and a static-page Content Security Policy are enabled.
- Global and signup-specific rate limits are enabled.
- JSON bodies are limited to 32 KiB and errors return generic server messages.
- `.env` and `.env.local` are ignored and no environment files are tracked.
- Full dependency audit reports zero known vulnerabilities.

## Verified behavior

- Missing bearer token: `401 Authentication required`.
- Forged bearer token: `401 session invalid or expired`.
- Disallowed origin: `403 Origin is not allowed`.
- API responses include CSP, HSTS, anti-sniffing, frame and rate-limit headers.
- Frontend and server compile with strict TypeScript settings.
- Production frontend and server builds complete successfully.
- The automated RLS audit passes for all nine application tables and verifies that browser roles cannot update registration or attendance columns directly.
- Public catalogue, book detail, club selection, event detail and homepage endpoints return live Supabase data.
- Search validation returns `400`, missing books return `404`, and protected profile/shelf routes return `401` without a valid session.
- Supabase reports the email provider and signup as enabled, with automatic email confirmation disabled.

## Remaining deployment actions

### Medium: verify the PostgreSQL server certificate

The active connection is encrypted, but the shared pooler's certificate chain is not trusted by the local Node trust store. Download the project root certificate from Supabase Database Settings and set `DATABASE_SSL_CA_FILE`. The backend will then use strict certificate verification.

### Medium: replace the `postgres` connection with a least-privilege role

The current Supabase connection uses the administrative `postgres` database role. Before a public production launch, create a dedicated backend login role with only the permissions required by the API routes and use its pooler connection string.

### Low: use a shared rate-limit store when horizontally scaled

The current in-memory limiter is suitable for one Node process. Multiple production instances should use a shared store such as Redis.

### Operational configuration

- Add exact local and production redirect URLs in Supabase Auth.
- Configure production SMTP and review Supabase's email rate limits.
- Restrict PostgreSQL network access to deployment egress addresses when the hosting platform provides stable addresses.
- Configure `TRUST_PROXY_HOPS` to the exact proxy count used by the host.
- Require MFA before adding any future administrator interface.
