# Comments

[Rule 15](rules.md) points here. A comment earns its place by telling the
reader something the code cannot tell them itself. If the same fact is already
in the lines below it, or in the git history, it does not belong in the file —
it is a second copy, and the copy in the file is the one nobody updates.

## Write one for

- **A constraint from outside the code.** A third-party API that rejects a
  request over a size limit it never documents, or a log collector that turns
  every object argument into `[object Object]`. Nothing in the file shows
  that, and no test can hold it.
- **A deliberately non-obvious choice**, where the obvious version is wrong.
  A value that looks inconsistent with its neighbours on purpose needs a line
  saying so, or the next editor "fixes" it.
- **A safety margin and what it guards against** — the value, the failure it
  prevents, and enough for the next editor to judge whether it still applies.

## Do not write

- **A restatement of the code.** "Log a warning message" above `warn()` adds
  nothing. Restatement also goes stale silently: a header that lists a
  component's two inputs is wrong the day a third one is added, and nothing
  fails when it is.
- **A narration of project history** — which issue shipped which line, what
  was tried and reverted, how the file came to look like this. Git and the
  linked pull request hold that already.
- **A second copy of what a test already proves.** Name the test instead. If a
  test measures every value a stylesheet sets and fails on a mismatch, the
  stylesheet needs one line pointing at it, not a re-argument of it.

## Where cut content goes

Removing a passage is not the same as throwing the knowledge away. Pick the
first row that fits:

| What it is | Where it goes |
| --- | --- |
| A fact still needed at that line | A shorter comment — a line or two |
| An invariant something already enforces | The test's name, cited in the comment |
| Why this particular change was made | The pull-request body |
| A convention others must follow | A `/docs` file |
| A decision that constrains future work | An ADR — the rare case, not the default |

An ADR is the last row for a reason. [decisions/README.md](decisions/README.md)
rules out "a decision confined to one file", which is what most in-file prose
is. Route a comment there only when it genuinely clears that bar.

## Citing an issue is not banned

A citation that points at something still live is itself a fact the code
cannot show. A guard that works around an open defect reads as an
inconsistency worth tidying unless the comment names that defect's issue.
Delete the citation and the next editor removes the guard. A citation that only
records which issue shipped a line is narration, and that one goes.

## Every file is covered

Templates, stylesheets, configuration and test files are as readable or as
unreadable as any other file. A test file header that re-argues what its own
assertions prove is the duplication above.

## What a tool checks, and what a reviewer checks

A linter or formatter can cover the mechanical half — layout, spacing, and
similar. No linter can tell a live pointer from a stale narration, so comment
*content* is a judgement call made in review. A search for issue numbers finds
candidates, never violations.
