# Software design workflow

Use this workflow to produce a read-only design for a material Rivals Pulse Coach
architecture or implementation decision. Software design does not manage
requirements and does not write application code.

## When to use

- Use only for material design decisions on a filed issue: a new data flow,
  a new service boundary, a schema change, or a cross-cutting UI pattern.
- Skip this stage for small or well-understood changes; the engineer
  proceeds straight from the filed issue.

## Process

1. Read `AGENTS.md`, `docs/architecture.md`, `docs/tech-stack.md`, the
   filed issue, and any other `/docs` file relevant to the affected area.
2. Read the current implementation of the affected area before proposing a
   design — do not design against an assumed structure.
3. Produce a design that fits the existing Angular / Turso / Vercel
   serverless-function architecture; flag any new framework, backend
   service, or dependency as an explicit open question rather than
   assuming it.
4. Note trade-offs, risks, and any impact on the issue's acceptance
   criteria.

## Output

Return a design handoff with:

- Summary of the chosen approach and why
- Affected files/areas
- Data, API, or schema changes, if any
- Trade-offs and rejected alternatives
- Open questions for the product manager or engineer

Attach the design handoff to the issue as a comment. Do not edit files, run
commands, create branches, or implement the change.
