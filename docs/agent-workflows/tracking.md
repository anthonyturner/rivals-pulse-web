# Tracking workflow (GitHub)

RivalsPulse tracks work in **GitHub only**. A GitHub issue is the work
item, its pull request is the change, and the two together are the complete
record. There is no second tracker, and no stage writes to one.

See [ADR-0002](../decisions/0002-track-work-in-github-only.md) for why,
including what this costs.

## Identity

Each work item is one GitHub issue, referred to by its number.

- The **branch** is `<type>/<issue-number>-<short-description>`, e.g.
  `feature/59-tools-row`. `<type>` follows this repository's convention, the
  prefixes `.github/workflows/issue-automation.yml` creates: `feature` for new
  behavior, `bug` or `fix` for broken behavior, `chore` for maintenance, and
  `docs`, `refactor`, `perf`, `test` or `ci` for work of that kind. Commit
  subjects still use Conventional Commit types (`feat`, `fix`, ...).
- The **pull request body** contains `Closes #<number>`, so the merge closes the
  issue.
- Do **not** put a bare `#<number>` in a commit body — see **Issue references
  in commits** in [implementation.md](implementation.md). Reference it in
  prose ("issue 123") instead, and keep the link in the pull-request body
  where it belongs.

## Status

Status is the issue's open/closed state plus its pull request's state. There is
no separate status field to keep in step, and nothing to transition. The Work
Queue board's Status column is computed from these; see below.

| Stage | After the stage |
| --- | --- |
| Product Manager files the item | Issue open, labelled |
| Engineering Refinement | Assessment posted as an issue comment |
| UX Design (optional) | Handoff posted as an issue comment |
| Software Engineer starts | Branch pushed |
| Draft pull request opened | Draft PR linked to the issue |
| Implementation verified | PR marked ready for review |
| QA review | Review posted as a PR comment; findings fixed |
| Squash merge | Issue closed by `Closes #n` |

**No agent closes an issue by hand.** Completion follows a merge. An agent that
closes an issue is asserting a result no merge has recorded.

### The Work Queue board is a computed view

Open issues from this repository and `anthonyturner/rivals_pulse` appear on the
**Rivals Pulse Work Queue** board (GitHub user Project 2). Its Status column is
derived from the table above and the labels below by
`scripts/work-queue-sync.mjs`, which `.github/workflows/work-queue.yml` runs for
every open issue every thirty minutes, and for one issue alone, after a short
debounce, on that issue's events. The first rule that matches wins:

| Board status | Comes from |
| --- | --- |
| Needs Tony | `needs-tony` label |
| In review | An open, non-draft pull request closes the issue |
| Agent working | An open draft pull request closes the issue |
| Ready | `ready` label |
| Backlog | Any other open issue |
| Done | The issue is closed (the project's own "Item closed" workflow) |

The **Iteration** field is derived too, and feeds the board's weekly "Current
iteration" view of what agents started. An issue's iteration is the week that
holds the creation date (in UTC) of its earliest open or merged closing pull request. It
stays empty when that date falls before the field's first iteration, and once
set it never changes, so an issue stays in the week its work started. The sync
adds a 7-day "Week of <Mon d>" iteration whenever the current or the next week
is missing.

**Never write to the board.** Do not add cards, move them, or set their Status
or Iteration.
Change the issue or its pull request and the board follows on the next run. See
overlay [ADR-0024](https://github.com/anthonyturner/rivals_pulse/blob/main/docs/decisions/0024-show-agent-work-as-a-computed-project-view.md) for
why.

### When only Tony can decide

When work cannot go on without a decision only the maintainer can make, follow
**Questions for the maintainer** in [pipeline.md](pipeline.md): the question and
your recommended answer are the latest comment on the issue, the issue carries
`needs-tony` (and keeps `ready`), and the card moves to Needs Tony. When Tony
answers by commenting, a workflow removes `needs-tony` and adds
`tony-answered`; see [tony-answers.md](tony-answers.md). Remove the label
yourself only if he answered somewhere else.

Your label and comment come from Tony's own account, so GitHub never notifies him
of them. Once a day, `.github/workflows/needs-tony-digest.yml` posts one comment
from github-actions[bot] on the pinned "Needs Tony digest" issue, listing every
open `needs-tony` item in both repositories and how long it has waited. Never
label that digest issue `needs-tony`.

## Labels

List the repository's real labels with `gh label list` before selecting any.
Never invent one. The set below is the vocabulary this workflow expects; a
repository that lacks one of these labels simply does not use it until a person
creates it.

| Kind | Labels |
| --- | --- |
| Type | `enhancement`, `bug`, `chore`, `documentation` |
| Priority | `P0`, `P1`, `P2`, `P3` |
| Area | `area:<name>`, one per part of the product, defined by the project |
| State | `needs-triage`, `needs-refinement`, `ready`, `blocked`, `duplicate`, `needs-tony`, `tony-answered` |

- `needs-refinement` — scope is not agreed yet; not ready to start.
- `ready` — refined and ready to start.
- `blocked` — say what it is blocked by in the issue body, and link that issue.
- `needs-tony` — stopped on a decision only the maintainer can make; the
  question and a recommended answer are the latest comment.
- `tony-answered` — a workflow sets it, in place of `needs-tony`, when Tony
  comments on a `needs-tony` issue. The coordinator acts on his latest comment,
  then removes it; see [tony-answers.md](tony-answers.md).
- `duplicate` — comment with a link to the original. A person closes the
  duplicate; an agent never closes an issue by hand.

## Hierarchy

For a body of work that splits into several issues, open a parent issue whose
body carries a task list of its children:

```markdown
- [ ] #41 Extract the export service
- [ ] #42 Add CSV export
- [ ] #43 Add the export button
```

GitHub renders the completion count and ticks items as they close. Link back to
the parent from each child. This is weaker than a real parent field — accepted
deliberately in [ADR-0002](../decisions/0002-track-work-in-github-only.md).

## Estimation

There is no story-point field and no velocity. Refinement still produces a
relative size — XS / S / M / L / XL — and it belongs in the refinement comment as
a sizing judgement, not as a metric anything totals.

Anything that comes out **L or XL is a split**, not an item. Refinement proposes
the split and the product manager files the pieces.

## Comments

Anything a stage produces that a reviewer needs — the refinement assessment, a
UX design handoff, the engineer's technical approach for substantial work,
escalation signals, a code review — is posted as a comment on the issue or the
pull request, whichever it scopes.

A decision that constrains future work is promoted to an ADR under
[docs/decisions/](../decisions/); a constraint that recurs across issues is
promoted to a rule in `/docs`. Issues close and are read only by whoever goes
looking; those two do not.

## Authorization

Creating and updating issues, commenting on issues and pull requests, marking a
verified pull request ready for review, and merging a reviewed one are
pre-authorized — see **How far an agent goes** in [pipeline.md](pipeline.md).
No stage asks permission to record its own output. Reading needs no approval
either.

What is still never an agent's to do: closing an issue by hand, deleting an
issue or a comment, and merging a pull request without a posted review.
