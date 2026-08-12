---
name: run-rivals-pipeline
description: Run the Rivals Pulse Coach planning stages (Product Manager, then optional Software Design) for a substantial feature. Use when the user explicitly invokes `$run-rivals-pipeline` in Claude Code or asks to take a substantial Rivals Pulse Coach feature from request to a filed issue with design ready for implementation. Do not use for small fixes, standalone issue drafting, or implementation/QA work — use `$implement-rivals-issue` (Claude Code) or Codex for those.
---

# Run the Rivals Pulse Coach planning pipeline (Claude Code)

Claude Code runs the planning half of the named pipeline in `AGENTS.md`:
Product Manager and, when warranted, Software Design. Implementation and QA
review happen via `$implement-rivals-issue` (in Claude Code) or Codex. Treat
invocation of this skill as explicit invocation of the named pipeline in
`AGENTS.md`, scoped to these two stages.

## Prepare

1. Read `AGENTS.md` and every file under `docs/agent-workflows/` completely.
2. Preserve unrelated working-tree changes and confirm repository identity and
   GitHub authentication.
3. Confirm the request is substantial feature work that needs a filed issue.
   For a small fix or one-off change, explain that this pipeline does not
   apply and offer to just help directly instead.

## Run the stages

Run stages sequentially. Wait for a completed handoff before starting the
next stage. Use the `se-product-manager` and `software-design` subagents.

1. Spawn `se-product-manager` with the complete request.
   - Require it to create or reuse a real GitHub issue.
   - Stop if it does not return an issue number and URL.
2. Evaluate the material-design threshold in
   `docs/agent-workflows/software-design.md`.
   - When the threshold is met, spawn `software-design` with the issue and
     relevant repository context.
   - Post its returned design to the issue as a comment (the design agent is
     read-only and cannot post it itself) when the user authorizes that
     external action.
   - Skip this stage for localized or already-designed work.
3. Stop here. Do not spawn implementation or QA as part of this skill — use
   `$implement-rivals-issue` for those stages, in Claude Code or Codex.

## Finish

Return the issue number, URL, labels, acceptance criteria, and the
design-comment URL when applicable. Close with a handoff pointer, e.g.:

```text
Issue #<number> is ready. Run $implement-rivals-issue to implement it here
in Claude Code, or switch to Codex and run $implement-rivals-issue there.
```

Never create a branch, edit application files, commit, push, or open a pull
request as part of this skill.
