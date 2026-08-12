# Tech Stack

## Frontend

- Angular 20
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

- GitHub Actions (`.github/workflows/ci.yml`)
