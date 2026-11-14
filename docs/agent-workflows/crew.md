# The agent crew

Every agent posts through the maintainer's own GitHub account, so a comment
alone does not say who wrote it. Each agent therefore works under a name from a
star-callsign crew and signs everything it writes. The maintainer comments as
himself, unsigned, and that is how his words are told apart.

## The roster

| Role | Names |
| --- | --- |
| Team lead, one per repository ([team-leads.md](team-leads.md)) | Capella (this repository), Polaris (the overlay `rivals_pulse`) |
| Developer, this repository (one name per concurrent-job slot) | Altair, Deneb, Sirius |
| Developer, the overlay repository `rivals_pulse` | Vega, Rigel, Lyra |
| QA reviewer | Argus |
| Product manager | Atlas |
| Engineering refinement | Orion |
| UX design | Iris |

Three developer names per repository match the three-job cap in
[pipeline.md](pipeline.md#how-many-run-at-once): a developer name is free when no
open draft pull request carries it.

## How a name is chosen

- **The team lead names every agent it starts**, in that agent's prompt.
- **A session working alone** takes its role's fixed name. For development that
  is the first developer name no open draft pull request in this repository is
  signed with:

  ```bash
  gh pr list --draft --state open --limit 200 --json body -q '.[].body | capture("<!-- agent: (?<n>[a-z0-9-]+) -->") | .n'
  ```

  It prints one name per signed draft. Empty output with exit code 0 means every
  developer name is free. A non-zero exit means treat the roster as full and
  report it, as the cap rule in
  [pipeline.md](pipeline.md#how-many-run-at-once) does for a failed count.
- **One name per job, for its whole life.** A handed-off job that another agent
  resumes may take a new name.

## The signature

Every comment, issue body, pull-request body and QA verdict an agent writes
starts with two lines: a hidden marker, then a visible header with the role's
emoji.

```markdown
<!-- agent: altair -->
**Altair** · 🛠️ dev
```

The marker is exactly `<!-- agent: <name> -->`: one space after the colon, the
name in lowercase letters, digits and hyphens, alone on the first line. The
header is `**<Name>** · <emoji> <role>`.

| Emoji | Role |
| --- | --- |
| 🧭 | lead |
| 🛠️ | dev |
| 🔍 | QA |
| 📋 | PM |
| 🧪 | refinement |
| 🎨 | UX |

- Never sign the maintainer's own words.
- A QA verdict is signed by the reviewer, even when the session that ran the
  review posts it (see [qa-review.md](qa-review.md)).
- Commits carry an `Agent: <Name>` trailer above the `Co-Authored-By` line:

  ```text
  Agent: Altair
  Co-Authored-By: <the platform's usual line>
  ```

## What reads the marker

Tools read the hidden marker, not the visible header:

- the Work Queue sync ([work-queue-sync.mjs](../../scripts/work-queue-sync.mjs))
  fills the board's Agent column from it, as [tracking.md](tracking.md)
  describes;
- the check that tells an agent's comment from the maintainer's answer treats a
  comment as an agent's when it carries either `<!-- agent -->` (the older,
  nameless marker) or `<!-- agent: <name> -->`
  ([tony-answer.mjs](../../scripts/tony-answer.mjs); see
  [tony-answers.md](tony-answers.md)).
