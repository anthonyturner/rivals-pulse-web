# GitHub Integration

This repo uses GitHub as the agile execution layer.

## Issues

Use issue templates for:

- Feature work
- Bugs
- Chores

Suggested labels:

- `feature`, `bug`, `chore`, `research`
- `needs-triage`, `needs-refinement`, `ready`, `blocked`
- `P0`, `P1`, `P2`, `P3`
- `area:home`, `area:heroes`, `area:api`, `area:database`, `area:docs`, `area:ci`

## Pull Requests

Every PR should include:

- Summary
- Type of change
- Verification result
- Linked issue when applicable
- Follow-up risk if anything remains

Path-based labels are applied by `.github/workflows/pull-request-labeler.yml`.

## Actions

`CI` runs on PRs and pushes to `main`:

```text
npm ci
npm run build
```

The build currently enforces Angular budget limits. If a PR fails because a component CSS file exceeds budget, either reduce CSS or create an explicit chore to change the budget policy.

`Sync Work Queue board` (`.github/workflows/work-queue.yml`) sweeps every open
issue every thirty minutes and on manual dispatch, and syncs just the one issue
an issue event names, after a 60-second debounce so a burst of events on one issue
makes one run. The sweep is the only full read, because every agent session shares
the token's GraphQL budget; each run logs its GraphQL cost and the budget left. It derives each card's Status and
Iteration on the Rivals Pulse Work Queue board from issue labels and pull request
state; see
**The Work Queue board is a computed view** in
[tracking.md](../agent-workflows/tracking.md). It reads the `WORK_QUEUE_TOKEN`
secret, a classic personal access token with the `repo` and `project` scopes.

## Agents

Use `AGENTS.md` for coding-agent instructions and `.github/copilot-instructions.md` for GitHub Copilot-style context.

Recommended agent assignment flow:

1. Create or refine an issue.
2. Add acceptance criteria.
3. Assign the issue to an agent or open a working branch.
4. Require a PR with CI passing.
5. Review against the Ready and Done checklists in `docs/agile/README.md`.

## Branch Naming

Suggested pattern:

```text
type/short-description
```

Examples:

```text
feature/agile-github-integration
bug/heroes-layout-budget
chore/css-budget-reduction
```
