# Repository Instructions

Rivals Pulse Coach is an Angular SSR app with Turso-backed content APIs. Prefer small, verified changes that preserve the existing component structure.

## Before Editing

- Read the affected component, service, and data files first.
- Check `docs/agile/backlog.md` and `docs/agile/sprint-board.md` for current priorities.
- Keep unrelated formatting and refactors out of PRs.

## Build And Verification

- Use `npm run build` for app and API typecheck verification.
- Do not run seed scripts unless explicitly requested; `db:seed` deletes and reloads content tables.
- For glossary-only additions, prefer `npm run sync:glossary:terms -- <term-id>`.

## UI Guidance

- Preserve responsive behavior at desktop and narrow widths.
- Avoid increasing component CSS budgets unless the budget is intentionally updated.
- If a page uses fixed columns, check that content does not overlap at common breakpoints.

## Data Safety

- Do not commit `.env`, database files, `dist`, `node_modules`, or temporary source dumps.
- Turso credentials must stay in environment variables only.

