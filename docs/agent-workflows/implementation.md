# Implementation workflow

Use this workflow to implement a filed work item. The item is tracked as a
GitHub issue — read [tracking.md](tracking.md) first. The issue is the scope
boundary; an issue design comment is authoritative for UI/UX when the optional
UX design stage was used. Architecture, interfaces, data flow, and technology
choices are decided here, as part of implementation, not by the UX design
stage — this workflow owns the technical solution.

Write the technical approach, the change report, and the pull-request body for
the requester, following the response formatting and audience rules in
[../response-style.md](../response-style.md): plain English first, technical
detail underneath, jargon explained the first time it appears, and file and
line references kept as evidence.

## Prepare

1. Read `AGENTS.md`, [../rules.md](../rules.md), [tracking.md](tracking.md),
   the complete work item — the GitHub issue and all of its comments — any
   design comment, and every relevant `/docs` instruction file, including the
   files under `docs/stack/`.
   Read `.github/copilot-instructions.md` too.
2. Confirm GitHub authentication, repository identity, default branch, current
   branch, remotes, and `git status --short`.
3. Preserve unrelated changes. Stop if they prevent safe isolation.
4. Use a branch named `<type>/<issue-number>-<short-description>` based on the
   current `master`, e.g. `feature/123-saved-filters`. The type follows this
   repository's branch prefixes, per [tracking.md](tracking.md).

## Open the draft pull request before implementing

The branch and the draft pull request go up **before the first edit**, not after
the last one. Nothing is written into the default branch's working tree, the
requester can watch the work arrive, and, where the project has continuous
integration (CI), it runs against every push instead of against one large diff
at the end.

```sh
git switch -c <type>/<n>-<short-description>       # off an up-to-date master
git commit --allow-empty -m "chore(scope): start <thing>"
git push -u origin <type>/<n>-<short-description>
gh pr create --draft --base master   # body carries Closes #<n>
```

The empty commit is not ceremony: GitHub refuses a pull request whose head
branch is not ahead of base, so a branch with no commits cannot have one. The
scaffold message is still a valid Conventional Commit, so any commit hook
passes it.

Fill the pull-request body in properly as the work lands — summary, verification
evidence, manual-test boundary, risks, escalation signals. A body left as a stub
is an unfinished handoff, not a finished one.

For a **defect**, the cause has to be confirmed before the issue can be filed
honestly (see **Defect lane** in [pipeline.md](pipeline.md)), so the branch
comes first under a provisional name and is renamed once the issue number
exists:

```sh
git branch -m fix/<n>-<short-description>
```

## When the work was written before the pull request existed

Sometimes the code already exists in the working tree and no branch or pull
request was ever opened. That is the wrong order — the section above is the
right one — but it happens, and the recovery is not a different workflow. It is
this one, entered late. The `open-pr` skill runs it.

1. Read `git status` and `git diff --stat` to see what is uncommitted, and
   preserve anything unrelated ([rule 5](../rules.md)).
2. Resolve the issue the work belongs to (`gh issue view <n>`), and confirm the
   uncommitted changes actually match its scope and acceptance criteria before
   going further. If no issue exists, file one first — see
   [planning.md](planning.md). Untracked work does not get a pull request
   ([rule 11](../rules.md)).
3. Verify as **Implement and verify** below describes, and report pass or fail
   plainly. Never silently skip a failing check.
4. Summarise the diff for the requester and carry straight on. Do not wait for
   approval ([rule 2](../rules.md)).
5. Branch, stage only the files the issue covers (never `git add -A` or
   `git add .`), then commit, push and open the pull request as **Publish**
   below describes.

The branch still precedes the commit here. What is skipped is opening the pull
request before the first edit, because the edits already happened; nothing else
about the workflow changes.

## Decide where to work: read `git status --short` first

One command decides this, and it is the first thing the stage does:

| `git status --short` | Where the work happens |
| --- | --- |
| **Empty** | The primary checkout. Branch in place as step 4 says — **no worktree**. |
| **Anything at all** | A worktree under `.claude/worktrees/`. |

`.claude/worktrees/` itself never counts: if it is the only entry, the tree is
clean, and the next section makes git ignore it.

A worktree (a second checkout of the same repository, on its own branch) is
isolation from someone else's uncommitted edits. It is not the default, and
choosing one when the tree is clean is not a harmless precaution — the costs
land on the requester, not on the agent that chose it. A fresh worktree needs
its own dependency install and copies of any gitignored local files before it
can build; reusing an old one instead hides drift between the two trees, and a
build that fails in one tree and not the other looks like a code defect when it
is not.

**Branching in place never means committing to `master`.**
Create the feature branch first — [rule 3](../rules.md) is unchanged. Re-check
`git branch --show-current` immediately before committing: someone switching
branches in that directory mid-task is how an agent's work travels across a
checkout and lands on the default branch.

### One exception on a clean tree

If a watch-mode build or a development server is running in the primary
checkout, use a worktree anyway. Switching branches under a live watcher makes
it rebuild from the new branch, changing the app the requester is running
mid-session.

This only bites when the branch switch changes files the build reads. A
docs-only branch off the same commit does not, so it does not need a worktree
even with the watcher running.

## Isolate in a worktree when the tree is already dirty

Everything in this section applies **only** when the check above sent you here.
Skip it entirely on a clean tree.

```sh
git check-ignore -q .claude/worktrees/x ||
  echo '.claude/worktrees/' >> "$(git rev-parse --git-common-dir)/info/exclude"
git fetch origin
git worktree add .claude/worktrees/<issue-number>-<short-description> \
  -b <type>/<issue-number>-<short-description> origin/master
```

The first line keeps the folder out of `git status`. Without it the primary
checkout shows `?? .claude/worktrees/` from the first worktree on, the check
above reads every later tree as dirty, and a careless `git add` stages a whole
checkout. It writes to the repository's local exclude file, so nothing is
committed.

Switching branches under someone's in-flight edits is how unrelated work gets
lost, and [rule 5](../rules.md) makes preserving it non-negotiable. A worktree
is the mechanism that makes rule 5 hold rather than merely intending it. The
requester is often mid-task in that tree, or another agent session is.

- Use `.claude/worktrees/` — one known location keeps them findable and easy to
  ignore.
- Run every command with the worktree as the working directory. Never edit the
  primary tree for issue work.
- Install dependencies inside the worktree with `npm ci`. Never
  share or link another tree's installed dependencies into it: a shared
  install means one tree's change rewrites every tree's dependencies at once.
- If the install fails because the lockfile no longer matches the dependency
  manifest, the branch is stale, not broken: rebase it on
  `master`. Do not regenerate the lockfile to make the error go
  away — that is a dependency change nobody asked for ([rule 6](../rules.md)).
- Gitignored local files the build needs, such as local environment settings,
  do not exist in a new worktree. Copy them in, and confirm with
  `git check-ignore` that they cannot be committed.

A worktree is scaffolding for one issue. Remove it once its pull request
merges (below) rather than leaving it to be reused by a later task, where it
drifts out of step with the primary checkout.

### The folder name binds on every creator

`.claude/worktrees/<issue-number>-<short-description>` is not only a convention
for people typing `git worktree add`. It binds on **anything** that creates a
worktree here, including a coding agent's own worktree-isolation feature, which
may name the folder after the agent's session (`agent-<id>`). A name like that
says nothing about what is inside it, and these accumulate alongside the
correctly named ones.

Two ways to comply:

- **Do not use the agent's auto-naming isolation.** Create the worktree with the
  command above instead, which names it correctly to begin with.
- **Or rename it before the first edit:**

  ```sh
  git worktree move .claude/worktrees/agent-<id> \
    .claude/worktrees/<issue-number>-<short-description>
  ```

  Rename before opening an editor on it, never after. On some systems the move
  fails outright while any program holds the folder open.

**Why the issue number and not the pull-request number.** The order this
document requires is worktree → branch → push → draft pull request → implement.
When the folder is created the pull request does not exist yet; only the issue
number does. Naming by pull request would need a rename afterwards, and would
invalidate any path already stored or any editor already open on it. The issue
number exists before the worktree does and never changes.

**A folder name is never evidence of what a worktree holds.** It is set once, at
creation, and a branch can be renamed afterwards — a folder named
`40-export-button` can hold branch `fix/41-export-encoding` for pull request 45.
So **match on the branch, never on the folder name**, when resolving which
worktree holds a piece of work. `git worktree list` prints the branch beside
each path, which is the reliable half. Opening the wrong one means editing the
wrong branch with no warning that you have.

### Clear the originals when the pull request opens

Copying files into a worktree leaves the originals sitting in the primary tree.
Once the pull request merges they become byte-identical duplicates of what is
now on `master`, and git refuses to overwrite them — so the
requester's next `git pull` fails:

```text
error: Your local changes to the following files would be overwritten by merge
error: The following untracked working tree files would be overwritten by merge
```

Untracked files are the harsher half: git will not clobber one even to create
an identical copy, so a new file blocks the pull just as firmly as an edited
one.

Offer to clear the originals when the pull request opens, not when it merges.
By then the content is committed and pushed, so nothing is at risk, and the
requester is still in the conversation to say no.

Confirm the originals are unchanged before discarding anything:

```sh
git diff --stat origin/<branch> -- <paths>                             # tracked files
git show "origin/<branch>:<path>" | diff - <path>                      # an untracked file
git ls-tree -r --name-only origin/<branch> -- <path>                   # is it in the commit at all
```

If they differ, the requester edited them after the copy. Stop and show them
the difference rather than discarding newer work. These are their changes, not
yours — clearing them is an offer, never an assumption.

Never read a failing `git show` as evidence that work did not merge; some
shells rewrite a `<rev>:<path>` argument before git sees it. Confirm a merge
from the pull request.

### Remove the worktree once the pull request is merged

A worktree is scaffolding for one issue, not a permanent checkout. Once the
pull request has merged, remove it:

```sh
git worktree remove .claude/worktrees/<issue-number>-<short-description>
git worktree prune
```

**Determine "merged" from the pull request, never from the commit graph.**
`gh pr view <n> --json state,mergedAt` is the authority. `git merge-base
--is-ancestor <branch> origin/master` is not: a squash or
rebase merge rewrites the commits, so a fully merged branch stops being an
ancestor of the default branch. Trusting ancestry leaves finished worktrees
behind in one repository and deletes live work in another.

Never remove a worktree for an open pull request, and never on the assumption
that a merge happened. Do it when you notice a merged worktree, or when asked.

Check the worktree is clean first (`git status --porcelain`), and check it
holds no link that points outside it. Uncommitted work inside one is the only
thing a removal can actually destroy — branches and commits survive, because
the branch is never deleted. If anything is uncommitted, leave the worktree
alone and report it.

Removing a worktree is not deleting a branch, which rule 3 forbids. Leave the
branch alone; GitHub disposes of the remote one on merge if the repository is
set to.

Abandoned worktrees accumulate. Each one is a full checkout on disk, and
together they make `git worktree list` useless for seeing what is actually in
progress.

## How far this stage goes

There is one mode: **run to the merged pull request without stopping**, per
**How far an agent goes** in [pipeline.md](pipeline.md). Filing the issue,
branching, committing, pushing, opening the PR, reviewing it and merging it
are all pre-authorized. Do not present an approach and wait, and do not present
the final diff and wait — the diff is reviewed on the pull request, in the
open, where the review leaves a record.

Carry any open question into the pull-request body rather than holding the
work back for an answer. When the answer would change what should merge, stop
before merging instead — see **Review and merge** below.

The narrow exception is the requester saying, for a specific piece of work, that
they want to see the diff before it goes up. Honour that for that work; it does
not change the default.

## Technical approach

Decide and state the technical solution before writing code. This is the
engineer's design work, and it is the step the UX design stage deliberately
does not cover.

For a defect, this investigation comes *before* the issue is finalized, not
after: the product manager needs a verified cause to write the issue against.
See **Defect lane** in [pipeline.md](pipeline.md).

1. Identify the root cause, or the mechanism the change hinges on, from the
   code rather than from the issue text alone. For a defect, say what actually
   produces the reported behavior and cite the file and line.
2. Name the module, service, or layer that owns the responsibility, and check
   whether one already does ([rule 10](../rules.md)) before adding a new one.
3. State the approach in a few sentences: what changes, where, why there
   rather than somewhere else, and the alternative rejected with its reason.
4. Note the blast radius — public signatures, existing callers, persisted
   shapes, and anything that stays deliberately unfixed.
5. For substantial work, post this as a comment on the GitHub issue before
   implementing, so it is reviewable on its own. For a small or obvious change,
   stating it in the response is enough. Either way it belongs in the
   pull-request body.
6. Report **escalation signals** when they occur, as defined in
   [refinement.md](refinement.md). On this stage the ones that matter most are:
   you revised the root cause after first stating it; you could not reproduce
   the reported behavior; a fix made a test pass without you being able to
   explain why; or two attempts at the diagnosis have not converged. Say so
   plainly instead of proceeding on the third guess — a confident wrong root
   cause is the most expensive failure this pipeline can produce.

## Implement and verify

1. Make only changes required by the issue and approved design.
2. For new logic, write or update the failing test first, then implement
   against it. This is the verification method, not an afterthought — skip it
   only for changes tests can't meaningfully cover (styling, markup, flows
   that can only be checked by hand in the running app).
3. Do not add dependencies or broaden scope without user approval
   ([rule 6](../rules.md)).
4. Run `npm run build` and `npm test` as the change warrants (there is no lint
   command yet) ([rule 8](../rules.md)).
5. Add a line under `## [Unreleased]` in `CHANGELOG.md` if a user of the
   project would notice the change, per [../changelog.md](../changelog.md). If
   not, say so in the pull-request body.
6. Review the complete diff and status for unrelated changes, secrets, and
   debug artifacts.
7. Report every changed file as a repo-relative markdown link with the
   changed line range(s), e.g. `[path/to/file:12-18](path/to/file#L12-L18)`
   (whole-file link for new files). Group the list by logical change if the
   work spanned multiple follow-ups in the same session. Note that
   uncommitted line numbers will shift if the diff changes again before
   commit. Also report verification evidence, risks, and manual testing.
8. Report the SOLID note. This is the only stage that writes one, so the
   format lives here; [rule 9](../rules.md) is the judgement about when SOLID
   is worth applying at all, and it points at this step. Name each principle
   you applied, say in a sentence how it is applied in this change, and why it
   was worth applying. Also name any principle you deliberately did not apply
   and why, so a reader can tell a considered omission from an oversight. An
   abstraction you considered and rejected is worth as much to a reviewer as
   one you built — say which, and what made it not worth it.

## Publish

Publication is pre-authorized; the pull request already exists from **Open the
draft pull request before implementing** above. This is where the real content
reaches it.

1. Use a Conventional Commit. Refer to the issue in prose in a commit body
   ("issue 123"), and keep the `#<number>` link for the pull-request body — see
   **Issue references in commits** below.
2. Push without force.
3. Update the pull request to the shape of `.github/pull_request_template.md` —
   Summary, Type, Verification, Changelog, Manual testing, Risks, Escalation
   signals — titled
   with the Conventional Commit subject, with `Closes #<n>` in the body. Replace
   the scaffold body; do not leave a stub.
4. Report the GitHub issue and pull-request URLs and the branch.

Then carry on to **Review and merge**.

## Review and merge

This is the gate that stands where a person reading a draft would otherwise
stand, so it is not optional and not shortened for small changes.

1. **Mark the pull request ready** (`gh pr ready <n>`) once Publish is done and
   every check you ran passes. GitHub cannot merge a draft.
2. **Review it.** Run the review in [qa-review.md](qa-review.md) — the
   `review-pr` skill — against the pull request as it now stands, from a fresh
   read of the diff rather than from memory of writing it.
3. **Post the review on the pull request** as a comment (`gh pr review <n>
   --comment` or `gh pr comment <n>`). Never as an approval: GitHub does not let
   an account approve its own pull request, and the review has to be readable
   by the requester afterwards either way.
4. **Fix the real findings.** Every blocking finding is fixed with a new
   commit on the branch. A non-blocking suggestion is fixed when you agree with
   it; when you do not, reply on the pull request saying why. Push without
   force, then re-review the new diff and post that review too.
5. **Merge when it is clean**, with a merge commit:

   ```sh
   gh pr merge <n> --merge
   ```

   A merge commit keeps the branch's commits intact, so the merge can be
   reverted as one unit and the history shows exactly what was reviewed.

Do **not** merge, and say why in the report and on the pull request, when:

- a blocking finding remains after a second review round;
- a check fails, or a required check has not run;
- merging would need branch protection bypassed (`--admin`) or a conflict
  resolved by guessing which side is right;
- two or more escalation signals were reported on this work;
- an open question in the pull-request body would change what should merge;
- the requester asked to see this piece of work before it merged.

Leave that pull request open and ready for review. Never close the issue by
hand ([rule 12](../rules.md)) — the merge closes it through `Closes #n`.

After merging, remove the worktree if the work used one, per **Remove the
worktree once the pull request is merged** above, and report the merge commit.

Merged or left open, finish by returning the checkout, per **Return the
checkout to `master`** below.

## Return the checkout to `master`

If you branched in place, put the primary checkout back on an up-to-date
`master` as the last thing you do:

```sh
git status --short            # must be empty -- everything is committed and pushed
git switch master
git fetch origin
git merge --ff-only origin/master
```

The branch's work now lives on the pull request, where the requester reviews
it. Leaving the checkout on the branch only makes them switch it back by hand
before starting anything else. If `git status --short` is not empty, something
was not published: stop and report it rather than switching. `--ff-only` makes
a stray local commit on `master` fail loudly instead of being
merged into it.

Work done in a worktree needs nothing here, because the primary checkout never
left `master`.

## Issue references in commits

Keep `#<number>` for the pull-request title and body, and for a real trailer
line such as `Closes #187`, where GitHub's linking is what actually matters.
In a commit body, spell the reference out in prose (`issue 187`).

This matters more than it looks under commitlint, which this project runs from
`.commitlintrc.json`. Never write a bare `#<number>` anywhere in a commit
**body**: it fails the commit hook, and the error it produces points at the
wrong thing.

commitlint's parser scans the message line by line for issue references
shaped like `#123`. The moment **any** body line contains that pattern, the
parser switches into "footer mode": every line from there on, including
ordinary prose, is reclassified as the footer and checked against footer-only
rules (`footer-max-line-length`, `footer-leading-blank`). It then fails even
when the real trailer further down is perfectly formed.

The error text — typically "footer must have leading blank line" — is
misleading. It is not complaining about the `Co-Authored-By:` or `Closes #n`
trailer. It is complaining about body prose that got swept into the footer by
mistake. It is not about length or line count; wrapped multi-line bodies are
fine. The only trigger is a bare `#<number>` outside the real footer.

Check before committing for real:

```sh
npx commitlint --edit <path-to-message-file> --verbose
```

When it fails, look for a bare `#<number>` in the body first. That is the cause
far more often than anything else.

Never force-push, rewrite history, delete branches, bypass branch protection,
or commit directly to `master`. Never close an issue by hand —
the merge closes it through `Closes #n`.
