# ADR-NNNN: <short imperative title>

- **Status:** Proposed
- **Date:** YYYY-MM-DD
- **Deciders:** <who agreed to this>
- **Related:** <issue/PR links, superseded or superseding ADRs>

## Context

The situation that forces a decision. What is true today, what is changing, and
what constraints apply (technical, product, platform). State the problem so a
reader who was not there can tell why doing nothing was not an option. Cite
code with file and line references where the constraint lives in the code.

## Decision

What was decided, in the active voice: "We will ...". One decision per ADR. Be
specific enough that a future change can be checked against it.

## Alternatives considered

Each alternative that was genuinely on the table, with why it was rejected. An
alternatives section that lists only strawmen is worse than no section — the
point is to stop the rejected option being reinvented in good faith later.

## Consequences

What follows from this, both directions:

- **What this makes easier.**
- **What this makes harder**, or what it costs. Every real decision has this
  side; if it appears empty, look again.
- **What now has to be true** — invariants future work must preserve.

## Compliance

How a reviewer can tell whether a change respects this decision: a test, a
lint rule, a documented check, or the specific thing to look for in review.
