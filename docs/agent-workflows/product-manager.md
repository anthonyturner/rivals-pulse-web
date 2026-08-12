# Product manager workflow

Use this workflow to turn a Rivals Pulse Coach request into a scoped, testable GitHub
issue. Product management owns requirements and issue creation, not design or
implementation.

## Process

1. Read `AGENTS.md` and confirm the repository identity and GitHub
   authentication.
2. Use existing context to identify the user, problem, desired outcome, and
   meaningful constraints. Ask only for information that cannot be discovered
   and would materially change the issue.
3. Search open issues for a clear duplicate. Reuse a matching issue.
4. List the repository's current labels before selecting any. Never invent a
   label or rely on a legacy label name.
5. Create the issue when the request authorizes issue creation.

## Issue format

- Use a sentence-case, imperative title.
- Include `Overview`, `User story`, `Context`, `Acceptance criteria`,
  `Technical notes`, and `Out of scope` sections.
- Write two to six independently testable acceptance criteria.
- Keep implementation choices in `Technical notes`; do not disguise a design
  decision as a product requirement.
- Record meaningful exclusions explicitly.

Return the issue number, URL, labels, acceptance criteria, and the appropriate
next stage. Do not create a branch, edit application files, or implement the
issue.
