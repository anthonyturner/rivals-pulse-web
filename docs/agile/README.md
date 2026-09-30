# Agile Workspace

This folder is the lightweight agile operating system for Rivals Pulse Coach. Use it to keep feature work small, visible, and shippable.

## Workflow

1. Capture ideas in `backlog.md`.
2. Refine the highest-value items until they have clear acceptance criteria.
3. Pull a small batch into `sprint-board.md`.
4. Work items from left to right: `Ready` -> `In Progress` -> `Review` -> `Done`.
5. Close the sprint by noting what to keep, what to improve, and one experiment for next time.

Use `github-integration.md` for issues, pull requests, GitHub Actions, labels, and agent handoffs.

## Ready

An item is ready when:

- The value is clear.
- The affected route, component, API, script, or data file is named.
- Acceptance criteria are testable.
- Known risks are written down.
- The item is small enough to finish without mixing unrelated work.

## Done

An item is done when:

- Acceptance criteria are met.
- The relevant build/test command has been run, or the reason it was not run is documented.
- UI changes have been checked at desktop and narrow widths when layout is affected.
- Data or deploy changes are reflected in README or docs when needed.
- No unrelated files were reformatted or changed.

## Cadence

- Sprint length: 1 week by default.
- Planning: choose a focused goal and 3-7 small items.
- Daily check-in: note yesterday, today, blockers.
- Review: verify the app behavior and update docs if needed.
- Retro: keep one thing, improve one thing, choose one experiment.

## Priorities

Use these labels mentally or in GitHub:

- `P0`: site is broken, deploy blocked, data loss risk.
- `P1`: core user workflow broken or misleading.
- `P2`: important improvement with clear user value.
- `P3`: polish, cleanup, nice-to-have.

## Issue Types

- Feature: user-facing capability or content workflow.
- Bug: broken behavior, data issue, visual regression.
- Chore: maintenance, build, docs, scripts.
- Research: uncertain problem that needs discovery before build work.
