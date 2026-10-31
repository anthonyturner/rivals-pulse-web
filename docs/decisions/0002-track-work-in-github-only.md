# ADR-0002: Track work in GitHub only

- **Status:** Accepted
- **Date:** Accepted when this playbook was installed
- **Deciders:** Project maintainers, by adopting the agent playbook
- **Related:** [tracking.md](../agent-workflows/tracking.md), [ADR-0001](0001-record-refinement-on-the-issue.md)

## Context

Agents file issues, post assessments, open pull requests and report status. If
work is tracked in a separate tracker as well as in GitHub, every one of those
writes happens twice, and the two copies have to agree. The playbook this
project adopted was shaped by running exactly that arrangement, and the cost
came out one-sided.

**What a second tracker costs, observed rather than estimated:**

- **Filing one item takes several writes, not one.** Create it in the tracker,
  create it in GitHub, then edit one of them to add the cross-link.
- **Every comment is written twice.** Summarising on one side is not an option:
  a reader on either side must reach the same conclusion. The rule is right; it
  just makes duplication mandatory.
- **The duplication fails in practice.** A single refused write mid-pipeline —
  a permission check, a network error — leaves the two systems disagreeing, and
  the repair is by hand.
- **Status drifts.** Items merged in GitHub stay "in progress" in the tracker
  unless an integration keeps them in step, and that integration is setup a
  small project rarely finishes.

**What it buys, for a small project:** sprints, story points, velocity and a
portfolio view. These are real for a team that runs sprints and reads the
numbers. For a project that never starts a sprint, nothing reads them.

The one part that reliably works is **identity** — an issue reference in the
branch name and pull-request title. GitHub alone provides that.

## Decision

We will track work in **GitHub only**. A GitHub issue is the work item; its pull
request is the change; the two together are the complete record.

- Issues, acceptance criteria, refinement assessments, engineering approach,
  design handoffs and review conversation all live on the GitHub issue and pull
  request, next to the diff they describe.
- Status is the issue's open/closed state plus its pull request's state. There
  is no separate status field to keep in step.
- Branches are named `<type>/<issue-number>-<short-description>`.
- No stage writes to any other tracker, and no agent is granted tools for one.

## Alternatives considered

- **Dual-track in a second tracker and GitHub.** Rejected on the costs above:
  paid on every operation by every stage, for benefits a small project does not
  use. Worth being precise about why — the arrangement is not wrong, it is
  written for a team running sprints with a velocity to measure and a portfolio
  to roll up. A project that becomes that team should revisit this ADR.
- **Use the second tracker as a board only, with GitHub as the record.** Removes
  the duplication, but still needs status automation between the two to be
  correct, which is the setup burden that makes dual-tracking fail in the first
  place.
- **Move to a different tracker.** Rejected: it reintroduces the two-system
  problem this decision exists to remove.

## Consequences

- **What this makes easier.** One write per piece of content. An entire class
  of failure — drift between two systems — stops existing, because there is
  only one copy. Fewer outward-facing writes per operation means fewer
  permission prompts and cheaper agent runs. The tracking contract stays small.

- **What this makes harder, and what it costs.** Real losses, not nominal ones:
  - **No sprints, velocity, story points or burndown.** GitHub has no built-in
    equivalent. If planning cadence is ever wanted, it has to be built or a
    tracker adopted by a superseding ADR.
  - **A weaker hierarchy.** A parent issue with a task list of children is
    weaker than a real parent field.
  - **A single point of failure.** If the repository is archived, made private,
    or GitHub is unavailable, the entire work record goes with it.

- **What now has to be true.** A GitHub issue exists for every tracked piece of
  work before it is implemented, and its pull request closes it with
  `Closes #n`. Refinement assessments and engineering approaches are posted as
  issue or pull-request comments, per
  [ADR-0001](0001-record-refinement-on-the-issue.md). Anything that constrains
  future work is still promoted to an ADR here rather than left in an issue
  thread, because issues close and ADRs do not.

## Compliance

Look at any issue. It should be a GitHub issue with no counterpart elsewhere,
and its pull request should carry `Closes #n` and no external tracker link. A
branch named with a foreign issue key, or an instruction file that tells an
agent to write to a second tracker, is the thing this decision exists to
prevent.
