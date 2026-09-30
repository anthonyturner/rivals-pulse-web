# Contributing to Rivals Pulse Coach

Rivals Pulse Coach uses a lightweight, issue-first GitHub flow. Every code change
starts with an issue, is developed on a short-lived branch, and reaches
`master` through a pull request. People and AI agents follow
the same flow; the agents' version, with the reasoning behind each step, is in
[docs/agent-workflows/](docs/agent-workflows/).

## Set up the repository

Requirements:

- The toolchain listed in [docs/tech-stack.md](docs/tech-stack.md)
- GitHub CLI (`gh`) authenticated to GitHub

Install and verify:

```sh
npm ci
npm run build
```

## Work on an issue

1. Create or choose a GitHub issue with testable acceptance criteria. The issue
   templates carry the sections an issue needs.
2. Update your local `master`.
3. Create a branch that includes the issue number.
4. Make focused Conventional Commits.
5. Push the branch and open a pull request that closes the issue.

```sh
git switch master
git pull --ff-only
git switch -c feature/42-saved-filters

git add <files>
git commit -m "feat(filters): save the current filter set"

git push -u origin feature/42-saved-filters
gh pr create --fill
```

The branch format is `<type>/<issue-number>-<short-description>`, for example
`fix/57-export-encoding`. The type follows this repository's branch prefixes
(the ones `.github/workflows/issue-automation.yml` creates):

| Type | Use |
| --- | --- |
| `feature` | New user-facing behavior |
| `bug` or `fix` | Broken behavior |
| `docs` | Documentation only |
| `chore` | Maintenance, dependencies, or tooling |
| `refactor` | Internal change without new behavior |
| `perf` | Performance improvement |
| `test` | Test-only work |
| `ci` | Automation changes |

## Commit messages

Use Conventional Commits:

```text
feat(filters): save the current filter set
fix(export): write files as UTF-8
chore(deps): update the test runner
```

`.commitlintrc.json` and `.husky/commit-msg` are in place to check the format
locally, but they do nothing until Husky and commitlint are added as dev
dependencies (not done yet).

Keep commits small and avoid mixing unrelated work. Add `Closes #42` to the
pull-request body so GitHub closes the issue after merge.

## Pull-request checks

A pull request is ready when:

- Acceptance criteria are met.
- A change users would notice has a line under `## [Unreleased]` in
  `CHANGELOG.md` — see [docs/changelog.md](docs/changelog.md).
- `npm run build` succeeds.
- `npm test` passes. (There is no lint command yet.)
- Visible changes include screenshots or a recording.
- Behavior that can only be checked by hand was checked, and the pull request
  says how.
- Any CI checks the project has configured pass.

Merge through GitHub once the review is done; the merge closes the issue. Start
the next task from an updated `master`.
