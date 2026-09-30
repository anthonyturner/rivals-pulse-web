# Planning workflow

Use this workflow to take a request from words to a **filed GitHub issue** that
someone can implement. It is the orchestration layer over three stages that each
have their own document: Product Manager
([product-manager.md](product-manager.md)), Engineering Refinement
([refinement.md](refinement.md)), and the optional UX Design
([ux-design.md](ux-design.md)).

This document says how those three are *run* — the order, what has to come back
before the next one starts, and what the caller reports at the end. What each
stage produces lives in the stage's own document, and is not repeated here.

Write every stage's output for the requester, per
[../response-style.md](../response-style.md): plain English first, technical
detail underneath.

## Where this stops

At the filed issue. This workflow never creates a branch, edits an application
file, commits, pushes, or opens a pull request — that is
[implementation.md](implementation.md), and it is a separate run.

To go further in one pass, see **Running the pipeline end to end** in
[pipeline.md](pipeline.md).

## Prepare

1. Read `AGENTS.md`, [../rules.md](../rules.md), and every file in this
   directory, [tracking.md](tracking.md) included.
2. Confirm repository identity, GitHub authentication (`gh auth status`), and
   that unrelated working-tree changes are preserved.
3. Confirm the request is substantial work that warrants the planning stages.
   For a small, well-understood fix, say the planning stages are not warranted
   and offer to help directly instead — the change still gets an issue, a
   branch and a pull request; what it skips is the ceremony, not the record.

## Run the stages

Run them sequentially. Wait for a completed handoff before starting the next
one. On a platform with subagents, each stage runs as its own agent so the
requester can see which stage produced what.

**0. Grilling — only if asked for by name.** Run it in the conversation with
the requester, before any stage starts, and carry what it settled into all of
them. A subagent cannot interview a person. Never start one unasked
([rule 13](../rules.md)).

**1. Product Manager drafts.** Give it the complete request. It searches for a
duplicate first and reuses a match. It returns a draft — problem, user, desired
outcome, constraints, candidate acceptance criteria — and does **not** file yet.

**2. Engineering Refinement assesses.** Evaluate the threshold in
[refinement.md](refinement.md). When it is met, give refinement the draft and
require the full assessment: approach options, risk, unknowns, per-criterion
testability, and a relative size with its reasoning. Skip the stage for a
localized, well-understood change, and tell the Product Manager it was skipped
so the issue can say so.

**3. Product Manager files — do not stop here.** The assessment goes to the
Product Manager, not to the requester
([ADR-0003](../decisions/0003-agent-autonomy.md)). Hand it over **in full**;
the reasoning is the deliverable, so do not compress it to a summary. Require
the Product Manager to:

- file the real issue against the assessment per [tracking.md](tracking.md),
  rewriting any acceptance criterion refinement found untestable;
- carry every assumption and unknown the assessment left open onto the issue as
  an explicit **Open questions** section — nobody challenges them before work
  starts now, so absorbing them into the body would let a guess read as
  established fact;
- act on a recommendation to split or to spike first, rather than filing the
  larger issue. Anything L or XL is a split, per [tracking.md](tracking.md);
- record the refinement size in the assessment comment, and set the type and
  area labels from [tracking.md](tracking.md), plus the parent issue's task
  list where one fits. It must **not** invent a priority label; the requester
  applies one when they triage.

Stop and report if no issue number comes back.

**4. UX Design — when the threshold is met.** Evaluate the threshold in
[ux-design.md](ux-design.md). Give it the issue and the relevant repository
context. It returns a design handoff with a text wireframe. Skip it for
localized or already-designed work.

## The caller posts what read-only stages cannot

Refinement writes nothing anywhere. UX Design writes nothing to the repository,
git or GitHub. Neither can post to the issue, so the assessment and the design
handoff reach it only if the caller posts them as comments. A stage's output
that stays in the transcript is lost the moment the session ends.

Post the assessment before the issue leaves refinement, and the design handoff
once UX Design returns. When the project draws wireframes on a design canvas,
the design comment names the file and artboard the wireframe was drawn on, or
says in one line that the canvas was unreachable and the wireframe is text
only.

## Report

Return, in the caller's own report:

- the issue number and URL, its labels, and the parent issue if any;
- the acceptance criteria;
- the refinement size and recommendation, or an explicit statement that
  refinement was skipped and why;
- the refinement- and design-comment URLs, where those stages ran;
- any label left unset, and why;
- **escalation signals, verbatim and up front.** Whatever the assessment
  reported, repeat it in full rather than summarising it, and say explicitly
  when there were none. These are the requester's cue to get a second opinion,
  and this report is the only place they still reach a person — the assessment
  itself no longer does. Never drop them to keep a handoff tidy.

When the assessment produced a decision that constrains future work, say so and
offer to record it as an ADR under [../decisions/](../decisions/). Do not write
the ADR as part of this workflow.

The issue stays open. Nothing closes it but a merge
([rule 12](../rules.md)).
