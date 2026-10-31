# Rivals Pulse Coach Copilot instructions

An Angular SSR coaching companion for Marvel Rivals: hero encyclopedia, counters, team builder, tier lists, game stats and guided lessons, served from Turso-backed APIs on Vercel.

This file is Copilot's entry point. It is deliberately short: it routes you to
the documents that hold the rules, and holds none of its own.

## Scope and precedence

- Read [AGENTS.md](../AGENTS.md) in full before any change. It is the index of
  every instruction file and says which one to read for which task.
- Read [docs/rules.md](../docs/rules.md) for the non-negotiable rules before
  generating any code. Rules are numbered; cite them by number.
- For agent work (planning, implementing, reviewing), read the matching file
  under [docs/agent-workflows/](../docs/agent-workflows/) completely and follow
  it. The agents in `.github/agents/` point there too.
- If guidance conflicts, follow the precedence order in AGENTS.md.

## Commands

- Install: `npm ci`
- Build: `npm run build` (app build plus API typecheck)
- Test: `npm test`
- Lint: none yet

Work happens on a branch, never directly on `master`.

## Reference docs

- [docs/rules.md](../docs/rules.md) rules 16 to 21 - this project's own rules:
  data safety, no reseeding, responsive UI and CSS budgets, backlog priorities.
- [docs/agile/](../docs/agile/) - backlog, sprint board, and issue and
  pull-request conventions.
- [docs/project-guide.md](../docs/project-guide.md) - automation workflows and
  skills specific to this repository.
- [docs/tech-stack.md](../docs/tech-stack.md) - the technologies in use.
- [docs/comments.md](../docs/comments.md) - when and how to write code comments.
- [docs/response-style.md](../docs/response-style.md) - how to write for the
  people reading your output.
- [docs/stack/typescript.md](../docs/stack/typescript.md) - TypeScript and npm
  rules. Read it before writing TypeScript or touching dependencies.
- [docs/stack/angular.md](../docs/stack/angular.md) - Angular architecture
  conventions. Read it before deciding where code belongs.
- [docs/stack/ui-components.md](../docs/stack/ui-components.md) - component,
  template and accessibility conventions. Read it before touching UI.

## Keep this file lean

This file holds only Copilot-specific orientation. Coding rules, standards and
conventions belong in `docs/`; add them there, not here. To add a new guide,
use the `create instructions` prompt, which also adds its row to the "Read
before you work" table in AGENTS.md.
