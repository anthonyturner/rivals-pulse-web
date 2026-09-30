# Architecture decision records

An architecture decision record (ADR) records a decision that constrains future
work, along with the context that made it the right call and the consequences
of living with it. It is a historical record, not documentation of current
behavior: an ADR is never rewritten to match what the code does now — it is
superseded by a later ADR.

Issues and pull requests are where decisions get *made*. They are a poor place
for decisions to *live*: they close, they are read only by whoever goes
looking, and the reasoning ends up scattered across a comment thread. An ADR is
the durable copy.

## When to write one

Write an ADR when a decision:

- constrains how future changes must be built (a state-ownership rule, a
  single-writer design, a mechanism for passing data between processes);
- introduces, replaces, or rejects a dependency;
- establishes a pattern others are expected to follow;
- was contested, or the rejected alternative is one a reasonable person would
  try again later.

Do not write one for a routine implementation choice, a decision confined to
one file, or anything already stated as a rule in [../rules.md](../rules.md)
or `/docs`. Roughly: if the next person to touch this area could reinvent the
rejected option in good faith, it needs an ADR.

## How

Copy [0000-template.md](0000-template.md) to
`NNNN-short-imperative-title.md`, using the next free number. Fill every
section; a "Consequences" section that lists only benefits means the decision
has not been thought through.

Status is one of `Proposed`, `Accepted`, `Superseded by ADR-NNNN`, or
`Deprecated`. Never delete an ADR — supersede it, and link both ways.

The first three ADRs came with the agent playbook. They record the decisions
the workflow is built on, so the reasoning travels with the rules instead of
living only in the playbook's own repository. Supersede them like any other
ADR when the project decides differently.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-record-refinement-on-the-issue.md) | Record engineering refinement on the issue | Accepted |
| [0002](0002-track-work-in-github-only.md) | Track work in GitHub only | Accepted |
| [0003](0003-agent-autonomy.md) | Agent autonomy | Accepted |
