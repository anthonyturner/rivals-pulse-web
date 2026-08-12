# Implementation workflow

Use this workflow to implement a filed Rivals Pulse Coach issue. The issue is the
scope boundary; an issue design comment is authoritative when the optional
software-design stage was used.

## Prepare

1. Read `AGENTS.md`, `.github/copilot-instructions.md`, the complete issue, any
   design comment, and every relevant `/docs` instruction file.
2. Confirm GitHub authentication, repository identity, default branch, current
   branch, remotes, and `git status --short`.
3. Preserve unrelated changes. Stop if they prevent safe isolation.
4. Use an issue-numbered branch named
   `<type>/<issue-number>-<short-description>` based on the current default
   branch.

## Approval mode

- **Standard or ad-hoc work:** before editing, present the approach, expected
  files, verification, assumptions, manual-test boundary, and branch; wait for
  approval. After verification, present the final diff and wait for approval
  before commit, push, or pull-request creation.
- **Named PM pipeline:** when the PM stage filed the issue and the caller
  explicitly invokes the repository pipeline, follow the autonomous draft-PR
  exception in `AGENTS.md`. Do not infer pipeline mode from the existence of an
  issue alone.

## Implement and verify

1. Make only changes required by the issue and approved design.
2. Do not add dependencies or broaden scope without user approval.
3. Run `npm run build` plus focused linting or tests appropriate to the change.
4. Review the complete diff and status for unrelated changes, secrets, and
   debug artifacts.
5. Report files changed, verification evidence, risks, and manual testing.

When publication is authorized, use a Conventional Commit, push without force,
and open a linked draft pull request using `.github/pull_request_template.md`.
Never merge, force-push, rewrite history, delete branches, or commit directly
to `main`, `master`, or `develop`.
