# Grilling workflow

Grilling is a relentless, round-based interview that stress-tests a request
before anyone acts on it.

**It is opt-in.** Run it only when the requester asks for it by name. It is not
a gate, not a precondition for filing an issue, and never something an agent
starts on its own initiative — see [rule 13](../rules.md).

The technique below is vendored from
[mattpocock/skills](https://github.com/mattpocock/skills) (MIT),
`skills/productivity/grilling`, with a project addendum appended. The
`grill-me` skill on each platform points here rather than restating it, and
its metadata turns off automatic invocation wherever the platform allows, so
[rule 13](../rules.md) is enforced by the loader rather than by a sentence
asking nicely. [skills.md](skills.md) lists where each platform's copy lives.

## The technique

Interview the user relentlessly until you reach a shared understanding. Map
this as a **design tree**: every decision branches into the decisions that hang
off it.

Work the tree in **rounds**. The **frontier** is every decision whose
prerequisites are already settled: the questions you can ask _now_ without
guessing at answers you haven't heard yet. Ask the whole frontier in one round:
number each question and give your recommended answer. Then wait for the user's
answers before the next round.

Format a round like so:

```text
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Each round the user answers reshapes the tree: settled decisions push the
frontier outward and unblock questions that depended on them. Recompute the
frontier and ask the next round. A question whose answer depends on another
question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a
fact from the environment (filesystem, tools, etc.), dispatch a sub-agent to
find it; don't ask the user for anything you could look up yourself. Don't
block on it: a running exploration is an unsettled prerequisite, so only the
questions downstream of it wait for the sub-agent to report; ask the rest of
the frontier now. The _decisions_ are the user's: put each to them and wait.

The session is done when the frontier is empty: every branch of the design tree
visited, nothing left silently assumed. Do not act on it until the user
confirms you have reached a shared understanding.

## Project addendum

**When it runs.** Only when the requester asks. Never file-blocking: an issue
drafted without a grilling session is a normal issue, and no stage may refuse
to proceed for want of one. Asking a couple of ordinary clarifying questions
while drafting is not a grilling session and does not need this workflow.

**Where it runs.** In the main conversation with the requester. A subagent has
no channel to them, so the product-manager subagent never runs a session
itself — it receives whatever a session settled as input.

**On a defect,** grill the symptom, the scope, and the acceptance criteria.
Do not grill the requester for a diagnosis — establishing the cause is
engineering's job under **Defect lane** in [pipeline.md](pipeline.md).

**What it produces.** No files, no branch, no issue. The output is settled
decisions, and they must land in the issue: `Context`, `Acceptance criteria`,
and `Out of scope`. A decision the session settled and the issue does not
record has been thrown away.

**Ungrillable questions.** Some questions cannot be answered by talking — how
a screen should look, or how an interaction should feel. Stop grilling when
you hit one, build or sketch the throwaway version, and come back with an
answer. Talking around an ungrillable question is how a session balloons.

**Question format.** Follow the repository's response rules in
[../response-style.md](../response-style.md) inside the interview too: plain
English first, technical detail underneath, and explain a repository-specific
name the first time it appears.

**One at a time.** The round-based default is deliberate, but the requester can
ask for one question at a time and that overrides it for the session.
