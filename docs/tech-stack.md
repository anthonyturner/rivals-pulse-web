# Tech Stack

What Rivals Pulse Coach is built on. Agents read this to avoid proposing a tool
the project does not use, so keep it current.

Stack rules: [stack/typescript.md](stack/typescript.md) for TypeScript and npm,
[stack/angular.md](stack/angular.md) and
[stack/ui-components.md](stack/ui-components.md) for Angular.

## Frontend

- Angular 20 (SSR via `@angular/ssr`)
- TypeScript
- Angular Signals
- RxJS

## Server / API

- Express (`src/server.ts`), used for local dev and SSR
- Vercel serverless functions (`api/`), used in production
- No separate backend framework/service (no ASP.NET, no Rails, etc.)

## Database

- Turso (`@tursodatabase/serverless`), SQLite-compatible

## Authentication

- None implemented

## AI

- None implemented (planned only — see `docs/coaching-engine.md`)

## Hosting

- Vercel (frontend, API functions, and cron-triggered sync jobs)

## Source Control

- GitHub

## CI/CD

- GitHub Actions (`.github/workflows/ci.yml`): `npm ci` and `npm run build` on
  pull requests

## Testing

- Karma and Jasmine (`npm test`)
- No lint command yet
