# ADR-0007: Squash-merge pull requests

- **Status:** Accepted
- **Date:** 2026-11-08
- **Deciders:** Anthony (maintainer).
- **Related:** issue 604. Amends the merge-method part of
  [ADR-0003](0003-agent-autonomy.md).

## Context

[ADR-0003](0003-agent-autonomy.md) had agents merge every pull request with a
merge commit, so each merge could be reverted as one unit and the history kept
every commit that was reviewed.

In practice the agents run many branches at once. Each branch collects its own
work-in-progress commits, then merges `master` back in, sometimes more than
once, to catch up before it lands. A merge commit carries all of that onto
`master`: one pull request adds its branch commits, its catch-up merges and the
merge commit itself. With several agent sessions merging a day, the `master`
graph has become hard to read, and finding which change introduced something
means wading through catch-up merges.

## Decision

We will squash-merge every pull request (`gh pr merge <n> --squash`). Each pull
request lands on `master` as one commit, titled after the pull request.

## Alternatives considered

- **Keep merge commits.** Rejected for the reason above: the graph is what the
  maintainer reads, and it no longer reads well.
- **Rebase merge.** Keeps every branch commit on a straight line. Rejected:
  agent branches carry fix-up and "address review" commits that are noise on
  `master`, and rebasing replays each one.
- **Keep merge commits but rebase branches instead of merging `master` in.**
  Rejected: updating a pushed branch by rebase needs a force-push, which
  [rule 3](../rules.md) forbids.

## Consequences

- **What this makes easier.** `master` reads one commit per change. Reverting
  a change is still one `git revert` of one commit. Catch-up merges inside a
  branch no longer matter.
- **What this makes harder.** The individual commits of a branch no longer
  appear on `master`; they stay on the pull request, which becomes the place to
  read how a change was built. A squash-merged branch is never an ancestor of
  `master`, so `git branch --merged master` does not list it, and the only
  local branch deletion rule 3 allows (`git branch -d` on a listed branch) no
  longer cleans those branches up; they accumulate locally until a person
  deletes them. Worktree removal already decides "merged" from the pull
  request rather than the commit graph, so it is unaffected.
- **What now has to be true.** Every agent merge is a squash merge. The pull
  request title is the commit title on `master`, so it must describe the
  change.

## Compliance

Look at any pull request an agent merged after this date: `master` should hold
exactly one new non-merge commit for it, with the pull request's title. A new
merge commit on `master` from an agent merge contradicts this decision.
