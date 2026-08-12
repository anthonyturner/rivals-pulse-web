# Agent Instructions — Rivals Pulse Coach

This file is the repository entry point for AI coding agents. Read it before
doing any work, then read the relevant docs below before generating code.

## Project summary

Rivals Pulse Coach is an Angular 20 SSR web app that acts as a companion/
coaching site for Marvel Rivals: hero encyclopedia, counter picks, tier
list, team comps, and game-stats content. It is a separate product from
the "Rivals Pulse" Overwolf in-game overlay app. Content is served through
Vercel serverless functions in `api/` backed by a Turso (SQLite-compatible)
database, with sync scripts in `scripts/` that populate that content from
external sources.

## Tech stack

- Frontend: Angular 20 (SSR via `@angular/ssr`), TypeScript, RxJS.
- Server/API: Express (`src/server.ts`) and Vercel functions in `api/`.
- Database: Turso (`@tursodatabase/serverless`), seeded/synced via scripts
  in `scripts/` (see `scripts/sqlite-schema.sql`).
- Hosting: Vercel (see `vercel.json`).
- Testing: Karma/Jasmine (`npm run test`).

See [docs/architecture.md](docs/architecture.md) and
[docs/tech-stack.md](docs/tech-stack.md) for full detail. Some other docs
under `docs/` (e.g. `coaching-engine.md`, `roadmap.md`) describe
product/domain plans that are ahead of what's implemented — verify against
the real source tree before treating a doc's claims as current behavior.

## Precedence

1. This file: workflow, approval gates, and non-negotiable rules.
2. [.github/copilot-instructions.md](.github/copilot-instructions.md):
   implementation conventions (build/verification, UI guidance, data safety).
3. [docs/agile/README.md](docs/agile/README.md) and
   [docs/agile/github-integration.md](docs/agile/github-integration.md):
   backlog, sprint board, and issue/PR workflow.
4. [docs/agent-workflows/](docs/agent-workflows/): canonical PM,
   software-design, implementation, and QA-review workflow definitions
   (see below).
5. Other files under `docs/` for product/domain context (hero system,
   coaching engine, content data flow, guides, prompts) — read the
   relevant one before touching that area, but verify claims against real
   code.

## Agent pipeline

Rivals Pulse Coach has one platform-neutral workflow with thin adapters per
platform. The adapters are entry points, not separate pipeline
definitions — all of them read the shared file in `docs/agent-workflows/`
for their stage and must not duplicate its rules.

Canonical stages:

1. **Product Manager** turns a request into a small, testable GitHub issue.
   Follow [docs/agent-workflows/product-manager.md](docs/agent-workflows/product-manager.md).
2. **Software Design** is optional and read-only. Use it only for material
   design decisions on a filed issue, then attach the design handoff to the
   issue as a comment. Follow
   [docs/agent-workflows/software-design.md](docs/agent-workflows/software-design.md).
3. **Software Engineer** implements the filed issue (and any design
   handoff), verifies it, and prepares a linked draft pull request. Follow
   [docs/agent-workflows/implementation.md](docs/agent-workflows/implementation.md).
4. **QA Reviewer** performs a read-only acceptance-criteria and pull-request
   review when requested. Follow
   [docs/agent-workflows/qa-review.md](docs/agent-workflows/qa-review.md).

Platform adapters:

| Stage | Claude Code (`.claude/agents/`) | GitHub Copilot (`.github/agents/`) |
| --- | --- | --- |
| Product Manager | [se-product-manager.md](.claude/agents/se-product-manager.md) | [pm-agent.md](.github/agents/pm-agent.md) |
| Software Design | [software-design.md](.claude/agents/software-design.md) | — (not yet added) |
| Software Engineer | [software-engineer-agent-v1.md](.claude/agents/software-engineer-agent-v1.md) | [developer-agent.md](.github/agents/developer-agent.md) |
| QA Reviewer | [qa-reviewer.md](.claude/agents/qa-reviewer.md) | — (not yet added) |

- Do not let the Software Engineer stage start implementation just because
  an issue exists — implementation only begins on an explicit request.
- Do not let the Software Design or QA Reviewer stage edit files, run
  write commands, commit, push, or merge — both are read-only.

### Handoff

The PM stage returns an issue number, URL, labels, acceptance criteria, and
the appropriate next stage — it does not create a branch, edit application
files, or implement the issue. The Software Engineer stage then reads that
issue (and any design comment), works on an issue-numbered branch, and —
outside the named-pipeline exception below — presents the approach for
approval before editing and the final diff for approval before
commit/push/PR.

If the user says "finish the implementation," treat it as a handoff request
to review the current branch, commit the changes, push the branch, and open
a draft PR to `master`.

### Scope and publication exception

The full PM → optional Software Design → Software Engineer → QA Reviewer
pipeline above is for substantial feature work. Small ad-hoc fixes and
one-off requests use the standard approval mode in
`docs/agent-workflows/implementation.md`.

When the named pipeline is explicitly invoked and its PM stage has filed the
issue, the Software Engineer stage may create the issue-numbered branch,
commit, push, and open a linked **draft** pull request without pausing for
per-diff approval. Human review remains mandatory at the draft PR. This
exception does not apply merely because an issue exists — it requires the
caller to explicitly invoke the named pipeline.

### Automation workflows

- [.github/workflows/issue-automation.yml](.github/workflows/issue-automation.yml):
  create a GitHub issue (and optionally a branch) from a plain-text request.
- [.github/workflows/create-issue-branch.yml](.github/workflows/create-issue-branch.yml):
  create a branch from an issue number or title-derived slug.
- [.github/workflows/create-pr-from-branch.yml](.github/workflows/create-pr-from-branch.yml):
  open a draft PR from an existing branch.
- [.github/workflows/mark-pr-ready-for-review.yml](.github/workflows/mark-pr-ready-for-review.yml):
  promote a draft PR to ready-for-review.

## Non-negotiable rules

1. Read every relevant doc (this file, `.github/copilot-instructions.md`,
   `docs/agile/`) before generating code.
2. Never commit, push, or open a pull request without explicit approval of
   the final diff, except for the explicitly invoked named pipeline
   described in the Scope and publication exception above.
3. Never merge, force-push, rewrite history, delete branches, or commit
   directly to `master`/`main`.
4. Never commit secrets, `.env`, database files (`data/*.db`), `dist`,
   `node_modules`, or temporary source dumps. Turso credentials stay in
   environment variables only.
5. Do not run `npm run db:seed` or other destructive/reseed scripts unless
   the task explicitly requires it — `db:seed` deletes and reloads content
   tables. For glossary-only additions, prefer
   `npm run sync:glossary:terms -- <term-id>`.
6. Preserve unrelated working-tree changes; stop if they block safe
   isolation. Keep unrelated formatting and refactors out of PRs.
7. Preserve responsive behavior at desktop and narrow widths for UI
   changes; avoid increasing component CSS budgets unless the budget is
   intentionally updated.
8. Run `npm run build` (app + API typecheck) and relevant tests before
   considering a change complete. State explicitly when manual UI/visual
   verification is still needed.
9. Keep changes scoped to the issue/task at hand; check
   `docs/agile/backlog.md` and `docs/agile/sprint-board.md` for current
   priorities before starting new work.

## Good first agent tasks

- Convert a backlog item into a GitHub issue.
- Add acceptance criteria to an unclear issue.
- Fix a narrow UI regression with screenshot notes.
- Add or update docs after script behavior changes.

## Useful skills

- Use the SOLID audit skill
  ([.github/skills/audit-solid-violations](.github/skills/audit-solid-violations))
  when reviewing a module for maintainability and design issues without
  changing behavior.
- Use the SOLID refactor skill
  ([.github/skills/refactor-toward-solid-design](.github/skills/refactor-toward-solid-design))
  when making a focused refactor toward cleaner, more extensible design.
- These are available automatically when the task matches their scope.
