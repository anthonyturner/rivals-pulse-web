# ADR-0001: Record engineering refinement on the issue

- **Status:** Accepted
- **Date:** Accepted when this playbook was installed
- **Deciders:** Project maintainers, by adopting the agent playbook
- **Related:** [refinement.md](../agent-workflows/refinement.md), [ADR-0003](0003-agent-autonomy.md)

## Context

A product manager who writes a complete issue — scope, acceptance criteria,
technical notes — with no engineering input, and hands it to the engineer as a
finished specification, produces two predictable failures. Acceptance criteria
get written that cannot be tested as worded, and scope is committed to before
anyone has read the code it would touch.

The defect lane already inverts the order for bugs: engineering establishes the
root cause before the issue is filed, because a cause nobody verified outlives
the guess. Feature work needs an equivalent gate.

On a delivery team this gate is backlog refinement, and it is where engineering
supplies feasibility, risk, and size before the ticket is considered ready. The
question is where that assessment should live once produced.

## Decision

We will run a read-only **engineering refinement** stage between the product
manager's draft and the filed issue for substantial feature work, and the
assessment it produces will be posted as a comment on the issue.

The issue comment is the assessment's home. The product manager quotes from it
into `Technical notes` rather than restating it, and reviewers read it to
understand why the work was scoped as it was.

Two kinds of content are promoted out of the comment:

- a decision that constrains future work becomes an ADR in this directory;
- a constraint that recurs across issues becomes a rule in `/docs`.

## Alternatives considered

- **Keep the assessment in the chat transcript only.** Free, and lost
  immediately. The transcript is not addressable from the issue or the PR, and
  the next person has no way to find it.
- **Give every refinement its own file in the repository.** Durable, but the
  large majority of assessments are ticket-scoped and stale within weeks.
  The repository would accumulate documents nobody supersedes, and the genuinely
  durable decisions would be buried among them.
- **Fold refinement into the engineer's technical approach step.** That step
  exists in `implementation.md`, but it runs *after* the issue is filed — too
  late to change the scope or the acceptance criteria, which is the whole point
  of the stage.
- **Have the product manager assess feasibility directly.** Removes a handoff,
  but it is the same failure the defect lane already rejects: product stating a
  technical conclusion it did not verify in the code.

## Consequences

- **Easier:** acceptance criteria arrive testable, because refinement checked
  each one against how it would actually be verified. Scope arrives sized, and
  L/XL work gets split before it is committed to rather than during it.
- **Harder:** one more sequential stage and one more handoff before any code is
  written, which is real cost on work that turns out to be small. The stage is
  therefore explicitly skippable, and a refinement that concludes "small, low
  risk, one file" is a signal it should have been skipped.
- **Now has to be true:** an issue filed through the pipeline for substantial
  feature work has a refinement comment, or a recorded reason the stage was
  skipped. The refinement agent stays read-only — it does not write the issue,
  and it does not implement.

## Compliance

Look at the issue. A substantial feature issue filed through the pipeline
should carry a refinement comment containing the sections in
[refinement.md](../agent-workflows/refinement.md), with file and line
references rather than assertions about the code. An issue whose technical
notes make claims that appear nowhere in a refinement comment is the thing this
decision exists to prevent.
