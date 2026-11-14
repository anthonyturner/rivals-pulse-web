# Tech Stack

What RivalsPulse is built on. Agents read this to avoid proposing a tool
the project does not use, so keep it current.

Stack rules: [stack/typescript.md](stack/typescript.md) for TypeScript and npm,
[stack/angular.md](stack/angular.md) and
[stack/ui-components.md](stack/ui-components.md) for Angular.

## Frontend

- Angular 20, server-rendered in production by `@angular/ssr` inside the
  `api/ssr.mjs` Vercel function (`vercel.json` rewrites every page to it), and
  locally by `npm run serve:ssr:rivals-pulse-coach`
- TypeScript
- Angular Signals
- RxJS

## Server / API

- Express (`src/server.ts`), used for local dev, the local server render and the
  production page render (`api/ssr.mjs` hands it requests)
- Vercel serverless functions (`api/`), used in production
- No separate backend framework/service (no ASP.NET, no Rails, etc.)

## Database

- Turso (`@tursodatabase/serverless`), SQLite-compatible: web content
- Supabase (Postgres and Edge Functions): the overlay upload backend, owned by
  this repo under `supabase/`; see [supabase.md](supabase.md)

## Authentication

- Supabase Auth, Discord sign-in only, with the session in an `HttpOnly` cookie
  held by our own `/api/auth/*` handlers (no Supabase code in the browser); see
  [architecture.md](architecture.md) and
  [ADR-0004](decisions/0004-add-player-accounts-private-to-the-owner.md)

## AI

- None implemented (planned only — see `docs/coaching-engine.md`)

## Hosting

- Vercel (frontend, API functions, and cron-triggered sync jobs)

## Analytics

- Vercel Web Analytics (`@vercel/analytics`): cookieless, aggregate page views
  and visitors. Loaded in the browser only and in production builds only; see
  `src/app/core/analytics/`

## Source Control

- GitHub

## CI/CD

- GitHub Actions (`.github/workflows/ci.yml`): `npm ci` and `npm run build` on
  pull requests, plus a job running the Supabase function tests
  (`npm run test:functions`)

## Testing

- Karma and Jasmine (`npm test`)
- No lint command yet
