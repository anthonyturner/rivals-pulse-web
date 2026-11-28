# Team leads

Each repository has one long-lived **team lead**: the session that takes work
from the maintainer, starts the other agents, runs the QA review and merges. It
is a role, not a person, and a fresh session can take it over (see
[Hand-off](#hand-off)).

## Who owns what

| Team lead | Owns | Its sessions are usually named |
| --- | --- | --- |
| Capella | This repository, the website (`rivals-pulse-web`) | `rivals-pulse-web-*` |
| Polaris | The overlay app (`anthonyturner/rivals_pulse`) | `rivalspulse-*` |

Find the live one in the session list (`ListAgents` in Claude Code). The names
come from the crew in [crew.md](crew.md).

## Routing

- A request for the other repository goes to its team lead by cross-session
  message. With no team lead running, file it there as an issue instead. Tell
  the maintainer where it went.
- Work that spans both: each team lead files and owns its own half, and they
  agree the order by message (for example, the website publishes first).

## Duties

- **Take work** from the maintainer, from the `tony-answered` issues
  ([tony-answers.md](tony-answers.md)) and from the Ready queue.
- **Respect the cap** of three jobs per repository
  ([How many run at once](pipeline.md#how-many-run-at-once)).
- **Name and brief every agent it starts**, from the roster in
  [crew.md](crew.md): the issue, the worktree, the signing, and the standing
  merge rule.
- **Own the QA review**: start the QA reviewer (Argus) itself, because an agent
  it starts may be unable to start agents, and post the signed verdict
  ([qa-review.md](qa-review.md)).
- **Merge once QA approves and the checks pass**, per **Review and merge** in
  [implementation.md](implementation.md#review-and-merge): mark the pull
  request ready and squash-merge it. File and implement what the review leaves
  as follow-ups as new issues, per [tracking.md](tracking.md).
- **Ask the maintainer** through the `needs-tony` inbox
  ([Questions for the maintainer](pipeline.md#questions-for-the-maintainer)),
  never only in chat, except a clarifying question about a request made in the
  conversation.
- **Report briefly** to the maintainer.
- **Clean up** finished worktrees and processes of the jobs it started, not
  other agents'.

## Hand-off

When its context is nearly full, the team lead writes a summary for a fresh
session and puts it in the message that starts that session. The session takes
the same name. The outgoing team lead also messages the other team lead to say
so.
