# Engineering refinement workflow

Use this read-only stage after the product manager has drafted a feature
request and **before** the issue is filed. Engineering assesses what the change
would actually take; the product manager then writes the issue against that
assessment.

This mirrors backlog refinement on a delivery team: the product manager owns
the problem and the priority, engineering owns the feasibility, the risk, and
the size. An issue written without that input states a scope nobody has
checked.

This stage is not the defect lane. On a reported defect the engineer
establishes the root cause first, following **Technical approach** in
[implementation.md](implementation.md); see **Defect lane** in
[pipeline.md](pipeline.md). Refinement answers "what would this cost and what
could go wrong", not "why is this broken".

## When to run it

Run refinement when the request is substantial feature work: it touches more
than one module or service, introduces or changes persisted state, adds a
dependency, affects a performance-sensitive path, or the product manager
cannot describe the change in terms of code that already exists.

Skip it when the change is localized and well understood — a copy change, a
styling tweak, reusing an existing shared component as-is. A refinement that
concludes "small, low risk, one file" was not worth the stage.

## Process

1. Read `AGENTS.md`, [../rules.md](../rules.md), every file under
   `docs/stack/` that applies to the change, and the product manager's draft.
2. Read the code the change would touch. Cite what you actually read; do not
   assess from the draft text alone.
3. Search for prior art before proposing anything new: an existing module or
   service that already owns the responsibility ([rule 10](../rules.md)), an
   existing shared component, an existing pattern for the same problem
   elsewhere in the codebase.
4. Produce the assessment below.
5. Hand it to the product manager, who files against it without waiting on
   anyone; see **Who receives the assessment** below.
6. Return it to the caller, who posts it as a comment on the issue once the
   issue exists. This stage writes nothing itself: do not edit files, create
   branches, comment, or implement anything.

## How to write it

These rules extend the rules in [../response-style.md](../response-style.md),
which apply to every stage; refinement holds itself to the fuller version
below because its entire output is its reasoning.

Write for the person who asked for the work, not for another engineer. They
decide the size, the split, and the priority off this assessment, so they have
to be able to read it without knowing the codebase.

- **Plain English first.** Lead every section with what it means in ordinary
  words, then give the technical detail underneath. "The settings page and the
  background worker are two separate processes, so they can't just share a
  variable — we'd have to pass the value between them" beats "cross-process
  state requires an explicit propagation mechanism".
- **Explain a term the first time you use it.** Debounce, idempotent, blast
  radius, migration — one short clause in parentheses is enough. Do not drop
  a repository-specific name (a module, a service, a stored setting) without
  saying what it does.
- **Short sentences, active voice.** Say "this would break the login form",
  not "a regression in the login form would be introduced".
- **No hedging stacks.** One clear statement of what you believe, plus the
  assumption it rests on, is better than three layers of qualifiers.
- **File and line references stay.** They are evidence, not prose — put them in
  parentheses after the plain-English claim so a reader can skip them.
- **Keep the tone level.** No selling, no dramatics, no apologising for
  complexity. Describe the work as it is.

Being readable is not the same as being brief. Keep every section below and all
the reasoning behind it — this is the one stage whose entire output is its
reasoning, and a thin assessment is worse than none, because it launders a
guess into a plan. Say the same things in fewer syllables, not fewer facts.

## Assessment format

Every claim about the codebase carries a file and line reference. Every claim
you could not verify is labelled as an assumption, in those words.

Produce all of the following sections.

### Understanding

Restate the request as engineering understands it, including what you believe
the user is actually trying to accomplish. Name any place the draft is
ambiguous and say which reading you assessed against.

### What exists today

The current behavior and the code that produces it, with file and line
references. Include the modules, services, components, and persisted data
involved, and the process or runtime they run in. State what already does part
of the job.

### Approach options

At least two viable approaches whenever more than one exists, each with:

- what changes and where;
- why there rather than somewhere else;
- what it costs — new files, changed public signatures, migrations;
- what it forecloses.

Recommend one and say why. A single-option assessment must justify why no
alternative is viable.

### Risk and blast radius

- Existing callers, public signatures, and persisted shapes affected.
- Boundaries the change crosses: state shared between separate processes,
  services, windows or clients needs an explicit mechanism, and a shared
  variable is not one.
- Performance implications when the change touches a hot path: render cost,
  update frequency, query count, payload size.
- Behavior that cannot be verified automatically and will need manual
  validation in the running app.
- What could regress that the acceptance criteria would not catch.

### Unknowns

Everything you could not establish from the code, each with how it would be
resolved: a question for the user, a capture of real runtime data, or a
timeboxed spike. Say plainly when a spike should precede the issue rather than
the issue being filed on a guess.

### Testability

How each proposed acceptance criterion would be verified: a unit test, a build
check, or manual validation in the running app. Flag any criterion the product
manager drafted that cannot be tested as written, and propose a testable
rewording. This is where the product manager's criteria get their teeth.

### Size

A relative size — **XS / S / M / L / XL** — with the reasoning that produced it,
not a bare label. Deliberately relative, not an hour estimate: compare against
work already in the repository, and say what that comparison work is in plain
terms ("about the size of the change that added the export button", "larger
than the saved-filters preference"). State what would make it bigger.

Split the request when it comes out L or XL, and propose the split: what ships
first, what it delivers on its own, and what depends on it.

Give the letter. The size is a sizing judgement recorded in this assessment,
not a metric anything totals — see [tracking.md](tracking.md). Anything that
comes out L or XL is a split, not a story.

### Recommendation

One of:

- **Ready to file** — with the acceptance criteria and technical notes the
  product manager should carry into the issue.
- **Needs a spike first** — with the question the spike answers and its
  timebox.
- **Needs a product decision** — with the decision and the options.
- **Should be split** — with the proposed sequence.

End with a one-line **Confidence** statement, in plain words: how much of this
assessment rests on code you actually read versus on inference, and what would
change the recommendation.

### Escalation signals

Report any of the following that occurred, as a short list under the
recommendation, labelled **Escalation signals**. Omit the list entirely when
none apply — an empty list is the normal case and padding it makes the real
ones unreadable.

These are observations about the work, not a judgement about your own ability.
Do not try to assess whether you are "capable enough" for a task; models are
unreliable at that, and a confident wrong self-assessment is exactly the
failure this list exists to catch. Report the facts and let the reader decide
whether to escalate:

- You reached a conclusion and then revised it during the assessment.
- Every approach you found has a serious drawback — there is no good option,
  only a least-bad one.
- A fact the recommendation depends on could not be verified from the code, and
  there is no cheap way to verify it.
- The mechanism hinges on runtime behavior only observable in a live
  environment: the running app, a third-party service, or production data.
- Two parts of the codebase imply different answers and you could not tell
  which is authoritative.
- The size came out L or XL and no clean split presented itself.
- You are relying on an assumption that, if wrong, invalidates the whole
  assessment rather than one section of it.

Two or more signals on the same assessment is the practical threshold for
getting a second opinion — from a person, or by re-running the stage on a more
capable model.

## Who receives the assessment

The assessment goes to the **product manager**, who files the issue against it
directly. Nothing waits for the requester; they see the work on the pull
request, reviewed and merged, per **How far an agent goes** in
[pipeline.md](pipeline.md).
[ADR-0003](../decisions/0003-agent-autonomy.md) records why, and what it costs.

A sign-off by the requester at this point would do three jobs. They do not go
away without it, so write the assessment such that the product manager can do
them:

- **Assumptions and unknowns must survive into the issue.** They exist to be
  challenged, and nobody challenges them before filing. State each one
  plainly enough that it can be filed verbatim as an open question. An
  unchallenged assumption that reaches the issue silently reads as an
  established fact, and that is the failure mode this stage has to prevent
  on its own.
- **Say what the split is, not just that one is needed.** Sizing and splitting
  are acted on rather than approved. Anything L or XL is a split per
  [tracking.md](tracking.md), so propose the pieces concretely enough to file.
- **Do not set priority.** It is not engineering's call. The issue is filed
  without a priority label and the requester applies one when they triage.

A misunderstanding that would cost a paragraph here costs an issue, a branch,
an implementation and a review once it gets past this stage. That raises the
bar on this document: it is the last place a wrong assumption can be caught
cheaply, and it is read by an agent that will act on it rather than by a
person who will question it.

## Where the assessment is recorded

- **The work-item comment is the home of the assessment.** It is scoped to the
  ticket, it is versioned by the conversation, and it is where a reviewer looks
  when asking why the work was scoped this way. It goes on the GitHub issue —
  this stage is read-only, so the product manager or the calling skill posts
  it. Post it before the issue leaves refinement, and let the product manager
  quote from it into `Technical notes` rather than restating it. See
  [ADR-0001](../decisions/0001-record-refinement-on-the-issue.md).
- **A durable architecture decision goes in an ADR** under
  [docs/decisions/](../decisions/), not only in the issue comment. Issues get
  closed and are read only by whoever goes looking; a decision that constrains
  future work needs a home in the repository. See
  [docs/decisions/README.md](../decisions/README.md) for when an ADR is
  warranted.
- **A repeated convention goes in `/docs`**, not in an issue. If refinement
  finds itself explaining the same constraint on a third issue, that constraint
  belongs in a `/docs` file — under `docs/stack/` when it is about the
  language or framework.

This stage is read-only in every system. Do not edit files, create branches,
commit, push, open pull requests, write to a work item, or begin
implementation. Read existing issues freely for context — prior assessments on
related items are often the fastest way to understand what exists today.
