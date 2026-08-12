# QA review workflow

Use this workflow to perform a read-only review of a Rivals Pulse Coach pull
request against its linked issue's acceptance criteria.

## Process

1. Read `AGENTS.md`, the linked issue (including any design comment from
   `docs/agent-workflows/software-design.md`), and the complete PR diff.
2. Check each acceptance criterion against the diff — mark it met, not met,
   or not verifiable from the diff alone.
3. Check CI status and relevant check evidence (build, tests) before
   approving.
4. Check for unrelated changes, secrets, debug artifacts, and scope creep
   beyond the issue.
5. For UI changes, check the responsive-behavior and CSS-budget guidance in
   `.github/copilot-instructions.md`.

## Output

Return:

- Acceptance-criteria checklist, one line per criterion, marked
  met / not met / unclear
- CI / check status
- Findings, ranked most-severe first (empty if none)
- A recommendation: approve, request changes, or needs manual verification

Do not edit files, implement fixes, commit, push, or merge.
