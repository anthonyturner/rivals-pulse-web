---
name: implement-rivals-issue
description: Implement a tracked Rivals Pulse Coach GitHub issue via the `software-engineer-agent` subagent through a verified draft pull request. Use when the user explicitly invokes `$implement-rivals-issue` in Claude Code, or asks to implement a filed Rivals Pulse Coach issue without switching to Codex. Do not use for filing an issue or producing a design (`$run-rivals-pipeline` covers those) or for reviewing a pull request — QA review is a separate, explicitly requested step.
---

# Implement a Rivals Pulse Coach issue (Claude Code)

This skill covers the Implementation stage of the named pipeline in
`AGENTS.md`, entirely inside Claude Code, using the `software-engineer-agent`
subagent in `.claude/agents/`. It complements `run-rivals-pipeline`, which
covers Product Manager and Software Design only. QA review is out of scope
for this skill — run it separately (e.g. via the `qa-reviewer` subagent)
only when the user asks for it.

## Prepare

1. Read `AGENTS.md`, `.github/copilot-instructions.md`, and every file under
   `docs/agent-workflows/` completely.
2. Resolve the target issue. If none exists yet, file one first via
   `$run-rivals-pipeline` or the `se-product-manager` subagent — do not
   implement untracked work.
3. Confirm repository identity, GitHub authentication, default branch,
   current branch, and `git status --short`. Preserve unrelated
   working-tree changes; stop if they block safe isolation.
4. Determine approval mode per `docs/agent-workflows/implementation.md`:
   - **Standard mode** is the default.
   - **Named-pipeline (autonomous) mode** applies only when the caller
     explicitly invokes the named pipeline for this issue (for example,
     this skill was reached through `$run-rivals-pipeline`, or the user
     explicitly says to run the pipeline). Never infer it from the issue's
     existence alone.

## Run the implementation stage

Spawn `software-engineer-agent` with the issue number/URL, any linked
design comment, and the determined approval mode.

- **Standard mode:** run it across resumed turns so each approval gate in
  `docs/agent-workflows/implementation.md` reaches the actual user, not just
  the subagent:
  1. First turn: have it read context and return the proposed approach,
     expected files, verification plan, assumptions, manual-test boundary,
     and branch name, without editing anything. Relay this to the user and
     wait for approval.
  2. Resume the same agent to implement and verify (`npm run build` plus
     relevant lint/tests), then return the complete diff without
     publishing. Relay the diff to the user and wait for approval before
     any publication step.
  3. If approved, resume again to commit, push, and open a linked draft
     pull request using `.github/pull_request_template.md`.
- **Named-pipeline mode:** run it in one turn — implement, verify, commit,
  push, and open a linked draft pull request autonomously, per the
  autonomous exception in `AGENTS.md`.
- Stop and report if the agent cannot produce a clean build/verification,
  or does not return a draft pull-request URL once publication was
  authorized.

## Finish

Return the issue URL, branch, commit(s), draft pull-request URL,
verification evidence, and any remaining manual-test items. Note that QA
review has not been performed and is a separate step if the user wants it.

Never merge, force-push, rewrite history, delete branches, or commit
directly to `main`, `master`, or `develop`. Never skip an approval gate
that standard mode requires.
