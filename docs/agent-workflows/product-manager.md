# Product manager workflow

Use this workflow to turn a request into a scoped, testable work item tracked
as a **GitHub issue**. Product management owns requirements and work-item
creation, not design or implementation.

Read [tracking.md](tracking.md) before writing. It defines issue identity,
branch naming, labels, hierarchy, and estimation. This workflow says
*when* the product manager writes; `tracking.md` says *what* a correct write
looks like.

Write the issue and every comment for the requester, following the response
formatting and audience rules in [../response-style.md](../response-style.md):
plain English first, technical detail underneath, jargon explained the first
time it appears, and file and line references kept as evidence.

## Grilling is optional and requester-invoked

A **grilling session** is a relentless round-based interview that stress-tests
a request before it is written down. It is available, not required, and it is
never a gate on filing. See [grilling.md](grilling.md).

Run it only when the requester asks for it by name (the `grill-me` skill, see
[skills.md](skills.md)). Do not start one on your own initiative, do not
suggest it as a precondition for filing, and do not refuse to file because none
has happened. Ordinary clarifying questions are a normal part of step 2 below
and are not a grilling session.

When the requester does ask for one, it runs in the main conversation before
the draft — a subagent has no channel to them, so the product-manager subagent
never runs it. Carry what the session settled into the `Context`,
`Acceptance criteria`, and `Out of scope` sections; a decision it settled and
the issue does not record has been thrown away.

## Process

1. Read `AGENTS.md`, [../rules.md](../rules.md), and
   [tracking.md](tracking.md). Confirm repository identity and GitHub
   authentication (`gh auth status`).
2. Use existing context to identify the user, problem, desired outcome, and
   meaningful constraints. Ask only for information that cannot be discovered
   and would materially change the issue.
3. If — and only if — the requester asked for a grilling session, run it now,
   before drafting, and say in the handoff what it settled. Skip this step
   otherwise; it is not a precondition for anything below.
4. Search for a clear duplicate before filing — `gh issue list --search`,
   and search **closed** issues and open **pull requests** too. A stale
   pull request doing the same work is a duplicate that an issue-only search
   misses. Reuse a matching item rather than filing a second one.
5. Identify the parent issue per the hierarchy rules in
   [tracking.md](tracking.md). Add the new issue to an existing parent's task
   list wherever one fits; open a new parent only for a genuinely new body of
   work, and say so in the handoff.
6. List the repository's current labels (`gh label list`) before selecting
   any. Never invent a label, and never rely on a legacy label name.
7. For substantial feature work, hand the draft to engineering refinement
   before filing. Refinement returns feasibility, approach options, risk,
   unknowns, the testability of each proposed acceptance criterion, and a
   relative size; see [refinement.md](refinement.md). File the issue against
   what came back, not against the original draft — and when refinement says
   the work should be split or needs a spike first, act on that rather than
   filing the larger issue anyway. Skip this step for localized,
   well-understood changes, and say in the issue that it was skipped.

   Refinement hands the assessment straight to you and nothing waits for the
   requester ([ADR-0003](../decisions/0003-agent-autonomy.md)). That makes two
   things yours. File every assumption and unknown the assessment left open as
   an explicit **Open questions** section on the issue — absorbed into the body
   they read as settled fact, and nobody is checking them before the work
   starts. And act on the proposed split rather than filing the larger issue;
   anything L or XL is a split, per [tracking.md](tracking.md).

   Do **not** invent a priority label. Priority was never engineering's call
   and it does not become yours; file without one and let the requester apply
   it when they triage.
8. Create the GitHub issue — this is pre-authorized, see **How far an agent
   goes** in [pipeline.md](pipeline.md) — with the labels from
   [tracking.md](tracking.md). Label it `needs-refinement` when no size was
   agreed, `ready` when one was. State a blocker in the body and link the
   blocking issue; add the `blocked` label. Add it to its parent issue's task
   list.
9. Post the refinement assessment as a comment on the issue, and quote from
   it into `Technical notes` rather than restating it.

## Defects

A defect report is a symptom, not a diagnosis. Own the symptom, the priority,
and the scope; do not author a root cause.

- Record the reported behavior in the reporter's own terms, and the expected
  behavior alongside it.
- Use the cause established by the engineer's investigation (see **Defect
  lane** in [pipeline.md](pipeline.md)). If no investigation has happened yet,
  say so and file the symptom without a cause rather than inventing a
  plausible one.
- Write acceptance criteria against the observable symptom, so the issue stays
  verifiable even if the diagnosis turns out to be wrong.
- Keep the mechanism and the chosen remedy in `Technical notes`, attributed to
  the investigation.
- File a defect with the `bug` label and the priority label matching the
  triage decision. This is the one priority the product manager does set, and
  it is not an exception to step 7: it comes from the triage stage, which is
  product work, rather than being invented alongside the issue.

## Issue format

The issue forms in `.github/ISSUE_TEMPLATE/` (`feature.yml`, `bug.yml`,
`chore.yml`) are this repository's own and ask for fewer sections. An issue an
agent files uses the full format below.

- Use a sentence-case, imperative title.
- Include `Overview`, `User story`, `Context`, `Acceptance criteria`,
  `Technical notes`, and `Out of scope` sections, plus `Open questions` when
  refinement left anything open.
- Write two to six independently testable acceptance criteria.
- Keep implementation choices in `Technical notes`; do not disguise a design
  decision as a product requirement.
- Never state a technical claim refinement did not verify. An unverified
  guess in `Technical notes` outlives the guessing.
- Record meaningful exclusions explicitly.

Return the GitHub issue number and URL, the labels, the parent issue if any,
the refinement size if one was agreed, the acceptance criteria, and the
appropriate next stage. Say explicitly when a field was left unset and why. Do
not create a branch, edit application files, or implement the issue.
