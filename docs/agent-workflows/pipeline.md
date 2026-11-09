# The shared agent pipeline

Read this before starting any substantial piece of work, and before deciding
whether a piece of work is substantial. It defines the stages, who hands what
to whom, and how far an agent may go without asking.

RivalsPulse has one platform-neutral workflow with thin adapters for each
agent tool. The adapters are entry points, not separate pipeline definitions.

## Canonical stages

1. **Product Manager** drafts the request — problem, user, desired outcome —
   and files the real GitHub issue, per [tracking.md](tracking.md), once
   refinement has come back. Follow [product-manager.md](product-manager.md).
2. **Engineering Refinement** is read-only and runs *before* the issue is
   filed. Engineering reads the code the change would touch and returns
   feasibility, approach options, risk, unknowns, testability of each proposed
   acceptance criterion, and a relative size. The assessment goes to the
   **product manager**, who files the issue against it without waiting on
   anyone. Nothing stops here. The product manager acts on a proposed split,
   and carries every assumption and unknown the assessment left open onto the
   issue as explicit open questions rather than absorbing them into the body as
   settled fact. Priority is not filled in by either stage — the requester
   labels it when they triage. Skip the stage for localized, well-understood
   changes. Follow [refinement.md](refinement.md).
3. **UX Design** is optional. This is product/UX design, not software design.
   Use it only for material user-facing design decisions (wireframes, new UI
   patterns or components, information architecture, interaction flows,
   performance-sensitive rendering, accessibility). It returns a design handoff
   with a text wireframe, and the caller posts the handoff on the issue. It
   writes nothing to the repository, git or GitHub; a project that uses a
   design canvas may let it draw there too. Architecture, interfaces, data
   flow, and technology choices are the Software Engineer's responsibility, not
   this stage. Follow [ux-design.md](ux-design.md).
4. **Software Engineer** owns the technical solution: branches and opens the
   linked **draft** pull request *first*, then states the technical approach,
   implements the filed issue, verifies it, and fills the pull request in.
   The pull request is where the work becomes visible, so it comes before the
   work rather than after it. Follow [implementation.md](implementation.md).
5. **QA Reviewer** performs read-only acceptance-criteria and pull-request
   review. Follow [qa-review.md](qa-review.md).

Whoever starts an agent, a session or the team lead, names it in the agent's
prompt from the roster in [crew.md](crew.md), and the agent signs everything it
writes with that name.

## Defect lane

The order above is for feature work, where the problem is known and the
solution is not. A reported defect inverts that: the symptom is known and the
cause is not, so the cause has to be established before an issue can be
written honestly. Refinement does not apply here — it sizes and de-risks a
change nobody has built yet, whereas a defect needs a diagnosis.

1. **Triage** decides whether the report is real and how urgent it is. That is
   product work, and it is not a diagnosis.
2. **Software Engineer** reproduces the defect and establishes the root cause
   in the code, following **Technical approach** in
   [implementation.md](implementation.md). Engineering owns diagnosis and
   remedy on a defect, the same way it owns the technical solution everywhere
   else.
3. **Product Manager** files the work item with the verified cause, the
   symptom as reported, and acceptance criteria written against the symptom
   rather than against the fix. Never file a cause engineering has not
   confirmed: a plausible-sounding guess outlives the guessing.
4. **QA Reviewer** verifies the reported symptom is gone, not merely that the
   named cause was changed.

UX Design is skipped unless the fix changes what the user sees. A defect small
enough to diagnose and fix in one sitting does not need the lane at all — go
straight to the implementation workflow. It still gets an issue, a branch and a
pull request; what it skips is the ceremony, not the record.

Because a defect's cause has to be confirmed before the issue can be filed
honestly, the branch comes first here and carries a provisional name. Rename it
to `fix/<issue-number>-<short-description>` once the issue exists, then push and
open the draft pull request. The work still never happens on
`master`.

## Escalation signals

Every engineering stage reports **escalation signals** when they occur — the
observable facts listed in [refinement.md](refinement.md), such as a conclusion
revised mid-assessment, a load-bearing fact that could not be verified, or two
attempts at a diagnosis that have not converged. They are observations about
the work, never a self-assessment of the model's own ability, which is not
something a model judges reliably. Two or more on the same piece of work is the
practical threshold for a second opinion. A stage must never drop them to keep
a handoff tidy.

## Where an assessment or decision is recorded

An engineering assessment belongs on the work item it scopes, as a comment on
the GitHub issue. A decision that constrains future work is promoted to an
architecture decision record (ADR) under [../decisions/](../decisions/); a
constraint that recurs across issues is promoted to a rule in `/docs`. Do not
leave either in a chat transcript.

## Platform adapters

- Claude Code: the agents and skills ship in the agent-playbook plugin and are
  namespaced `agent-playbook:<name>`. Project-specific skills go in
  `.claude/skills/`.
- GitHub Copilot: `.github/agents/`, with `.github/copilot-instructions.md` as
  the always-on entry point.
- Earlier adapters: this repository's own agents and skills from before the
  playbook are still in place: `.claude/agents/` (`se-product-manager`,
  `software-design`, `software-engineer-agent-v1`, `qa-reviewer`),
  `.claude/skills/` (`run-rivals-pipeline`, `implement-rivals-issue`) and
  `.github/agents/` (`pm-agent`, `developer-agent`), with
  [software-design.md](software-design.md) behind the design stage. They
  predate the playbook and stop at a draft pull request. Prefer the playbook
  agents; retiring or re-pointing the earlier ones is separate work.

Keep shared behavior in `docs/agent-workflows/`. An adapter may contain only
platform metadata, capability restrictions, and instructions to load the
canonical workflow. That applies to skills exactly as it applies to agents: a
skill that restates a stage rule is a second definition of the pipeline, and
two definitions drift. [skills.md](skills.md) maps every skill to the document
behind it and to the platforms that expose it.

## When the pipeline runs

The full PM → Refinement → optional UX Design → Engineer pipeline is for
substantial feature work, and that is a judgement about **the work**, not a
magic word. Run it when the change is large, ambiguous, user-facing, spans
several files or introduces a new module or service. Skip refinement for a
localized, well-understood change and say in the issue that it was skipped, per
[product-manager.md](product-manager.md).

The `plan-issue` skill forces the planning stages when the requester wants them
run regardless, and `ship-feature` forces the whole sequence. They are ways to
ask for the pipeline, not the only way to get it.

## How many run at once

At most **three** issues in this repository are in progress at a time. The
count is the board, not any session's memory. A job in progress is an issue
whose card on the Rivals Pulse Work Queue reads **Agent working**, meaning it
has an open draft pull request (see
[tracking.md](tracking.md#the-work-queue-board-is-a-computed-view)). The
overlay repository, `anthonyturner/rivals_pulse`, has its own three, counted
separately.

Before you branch for a new issue, count this repository's jobs in progress:

```bash
gh project item-list 2 --owner anthonyturner --limit 1000 --format json -q '[.items[] | select(.status=="Agent working" and .repository=="https://github.com/anthonyturner/rivals-pulse-web")] | length'
```

- **Under three:** start as usual. Your draft pull request takes a slot.
- **Three or more:** do not start. Leave the issue in the Ready queue, report
  that the cap is full and name the three jobs holding the slots. Finishing or
  unblocking one of them is the way to free a slot.
- **Your own job pauses for days:** close its draft pull request with a comment
  naming the branch (keep the branch) and label the issue `ready`, so the slot
  frees and the next agent resumes from that branch.

Work the requester explicitly says to start now is exempt, and the report says
the cap was over.

## Questions for the maintainer

Every question that waits on the maintainer goes to one inbox: the issue,
labelled `needs-tony`, with the question and a recommended answer as its latest
comment. The maintainer finds everything that needs him on the board's Needs
Tony column instead of hunting through sessions and pull requests. A question
asked only in a chat, a closing session or a pull-request thread is not in the
inbox and may never be read.

The one exception: a clarifying question to a requester who is in the
conversation right now may be asked there. If it goes unanswered and the work
cannot go on, it goes to the inbox as well.

When work cannot go on without a decision only the maintainer can make:

1. **Add the `needs-tony` label** to the issue, and keep `ready` on, so
   removing `needs-tony` alone returns the card to Ready and the next agent
   resumes. Where no issue exists yet, file one with the label. A question
   about a pull request goes on the issue it closes.
2. **Post the question as a comment on the issue, after the label**, and make
   it the latest comment: what is being decided, why it blocks the work, the
   options, and your recommended answer, so a one-word reply is enough. Name the
   pull request in the text when there is one. Start the comment with
   `Waiting on Tony:` on its first line: it is how the answer workflow tells
   your question from his reply, because you comment as his account (see
   [tony-answers.md](tony-answers.md)).
3. **Hand an open draft pull request back** the way a paused job is handed back
   (see **Your own job pauses for days** above): push, close the draft with a
   comment naming the branch, keep the branch. That frees the slot.
4. **Move on** to other work that does not depend on the answer.

The order matters. GitHub's Slack app posts to #rivals-needs-tony only when an
issue is opened, closed or commented on while it carries `needs-tony` (the
subscription is filtered by `+label:"needs-tony"`). It does not post when the
label is added, so the comment is what notifies the maintainer, and it only
counts once the label is already on.

The maintainer answers in a comment on the issue. A workflow then swaps
`needs-tony` for `tony-answered`, and a coordinator picks the answer up, acts
on it and removes `tony-answered`; all of it is in
[tony-answers.md](tony-answers.md). Agents post as the maintainer's own
account, so his answer cannot be picked out by its author. Anyone resuming an
issue that was in the inbox reads every comment after the question before
anything else, per [implementation.md](implementation.md).

Every other comment you post on an issue or a pull request starts with the
hidden line `<!-- agent -->` (or `<!-- agent: <name> -->` for an agent with a
callsign name), so that it is never read as his answer. Sign it as
[crew.md](crew.md) says; the `Waiting on Tony:` question is signed too.

## Running the pipeline end to end

The stages above can be run one at a time or in a single pass. Both are the
same pipeline; the difference is only how many handoffs happen without the
requester in between.

| Run | Covers | Ends with |
| --- | --- | --- |
| [planning.md](planning.md) | PM → Refinement → optional UX Design | A filed issue |
| [implementation.md](implementation.md) | Software Engineer, with the QA review before the merge | A reviewed, merged pull request |
| [qa-review.md](qa-review.md) | QA Reviewer — inside implementation, or on its own for any open pull request | A review posted on the pull request |
| End to end | Planning, then implementation | A reviewed, merged pull request |

An end-to-end run is the documents above executed in sequence, each one
starting from the previous one's finished output: the issue number from
planning, then the pull-request URL from implementation. It adds no stage and
changes no rule. Stop and report if a run does not produce the artifact the
next one needs — a missing issue number or pull-request URL is a failed
handoff, not something to work around.

After the review is posted, the engineer fixes the real findings, and the pull
request is merged when **Review and merge** in
[implementation.md](implementation.md) says it may be. The review is posted as
comments, never as an approval: GitHub does not let an account approve its own
pull request, and an approval from the same hands that wrote the code would
mean nothing anyway.

## How far an agent goes

Work runs from request to **merged pull request without stopping for
approval**. The agent reviews its own pull request in the open, fixes what the
review finds, and merges when the review is clean. The requester reads the
record afterwards — the issue, the review comments and the merged diff — and
can revert any merge.

This is a standing authorization for the outward-facing actions along the way:
filing and updating GitHub issues, posting issue and pull-request comments,
creating branches, committing, pushing, opening pull requests, marking a
verified pull request ready for review, and squash-merging a reviewed one. No
stage asks permission to record its own output in GitHub.

The branch and a draft pull request are created **as soon as the issue exists
and before implementation begins** — see
[implementation.md](implementation.md). Nothing is written into
`master`'s working tree, and the requester can watch the work
arrive rather than waiting for it.

**The posted review is the gate, and it is a real one.** An agent never merges
a pull request that has no posted review, that still has a blocking finding, or
whose checks fail, and never bypasses branch protection to get one in. The
prohibitions in [rule 3](../rules.md) are unchanged: never force-push, never
rewrite history, never commit directly to `master`. A squash
merge lands each pull request as one commit on `master`, so any merge can be
reverted cleanly and the history stays one line per change
([ADR-0007](../decisions/0007-squash-merge-pull-requests.md)).

What this trades: a wrong approach now surfaces at the pull request rather than
before the code is written. That is deliberate. The protection against it sits
earlier in the pipeline — refinement happens before the issue is filed, so the
approach is assessed before implementation starts, and every assumption it
could not settle is filed on the issue as an open question.

See [ADR-0003](../decisions/0003-agent-autonomy.md).
