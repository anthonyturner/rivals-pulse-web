# Project guide for agents

Project-specific working notes for Rivals Pulse Coach that are too long for
[AGENTS.md](../AGENTS.md). They carried over from the repository's own
`AGENTS.md` when the agent playbook was installed. The rules themselves are in
[rules.md](rules.md) (project rules start at 16).

## Shortcuts

- If the user says "finish the implementation", treat it as a request to
  review the current branch, commit the changes, push the branch, and open a
  pull request to `master`.

## Automation workflows

- [issue-automation.yml](../.github/workflows/issue-automation.yml): create a
  GitHub issue (and optionally a branch) from a plain-text request. It picks
  the branch prefix (`feature`, `bug`, `chore`) from the issue type.
- [create-issue-branch.yml](../.github/workflows/create-issue-branch.yml):
  create a branch from an issue number or title-derived slug.
- [create-pr-from-branch.yml](../.github/workflows/create-pr-from-branch.yml):
  open a draft pull request from an existing branch.
- [mark-pr-ready-for-review.yml](../.github/workflows/mark-pr-ready-for-review.yml):
  promote a draft pull request to ready for review.
- [ci.yml](../.github/workflows/ci.yml) runs `npm ci` and `npm run build` on
  pull requests; the build enforces the Angular budgets.

## Useful skills

- The SOLID audit skill
  ([.github/skills/audit-solid-violations](../.github/skills/audit-solid-violations))
  reviews a module for maintainability and design issues without changing
  behavior.
- The SOLID refactor skill
  ([.github/skills/refactor-toward-solid-design](../.github/skills/refactor-toward-solid-design))
  makes a focused refactor toward a cleaner, more extensible design.

Both are picked up automatically when a task matches their scope. The
repository's earlier agents and skills, from before the playbook, are listed
under **Platform adapters** in
[agent-workflows/pipeline.md](agent-workflows/pipeline.md).

## Good first agent tasks

- Convert a backlog item into a GitHub issue.
- Add acceptance criteria to an unclear issue.
- Fix a narrow UI regression with screenshot notes.
- Add or update docs after script behavior changes.
