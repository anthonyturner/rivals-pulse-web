# Skill map

A **skill** is a named entry point an agent tool exposes — a command the
requester types to run one piece of the workflow. This file lists every one,
the canonical document it loads, and how each tool invokes it. It also lists
the agent behind each pipeline stage.

It exists so that a gap is visible rather than accidental. When one tool has a
skill and another does not, this map records whether that is a decision or an
oversight.

## The rule

A skill file holds **platform metadata, capability restrictions, and a pointer to
the canonical workflow. Nothing else.** This is the same rule agents follow, from
**Platform adapters** in [pipeline.md](pipeline.md).

A skill that restates a stage rule becomes a second definition of that stage, and
two definitions drift apart silently — one gets corrected and the other does not.
When a skill needs behavior that is not written down yet, the behavior goes in
`docs/agent-workflows/` first and the skill points at it.

## Pipeline skills

These are the same on every tool: same names, same scope, same document
behind them.

| Skill | Canonical document | Takes | Returns |
| --- | --- | --- | --- |
| `plan-issue` | [planning.md](planning.md) | A request | A filed issue |
| `implement-issue` | [implementation.md](implementation.md) | An issue number | A reviewed, merged pull request |
| `review-pr` | [qa-review.md](qa-review.md) | A pull request | A review posted on the pull request |
| `open-pr` | [implementation.md](implementation.md) | Uncommitted work plus an issue | A reviewed, merged pull request |
| `ship-feature` | [pipeline.md](pipeline.md) | A request | A reviewed, merged pull request |
| `grill-me` | [grilling.md](grilling.md) | A plan or idea | Shared understanding |

They chain in the order their names describe:

```text
plan-issue  ──▶  implement-issue  ──▶  review-pr
PM + refine + UX    engineer → PR        QA → verdict
     │                     ▲
     └──── issue #n ───────┘        open-pr ──┘
                               (recovery: code written first)

ship-feature = all three, end to end
```

`open-pr` is the recovery path, not a fourth stage. It reaches the same pull
request as `implement-issue`, entering the workflow after the code was already
written — see **When the work was written before the pull request existed** in
[implementation.md](implementation.md).

`grill-me` produces no artifact and files nothing. It is opt-in, by name only
([rule 13](../rules.md)), and its metadata turns off automatic invocation
wherever the tool supports that, so the rule is enforced by the loader rather
than by prose.

## How each tool invokes them

**Claude Code.** The skills and agents ship in the agent-playbook plugin, so
they are namespaced: type `/agent-playbook:<skill>`, for example
`/agent-playbook:plan-issue`. The stage agents are `agent-playbook:pm`,
`agent-playbook:refine`, `agent-playbook:ux-design`, `agent-playbook:dev` and
`agent-playbook:qa`; the skills start them as subagents.


**GitHub Copilot.** Copilot has no skill command here; pick the custom agent
from the agent picker in Copilot Chat instead. The agents live in
`.github/agents/<name>.agent.md`.

| Skill | Copilot custom agent |
| --- | --- |
| `plan-issue` | `orchestrator`, asked to plan only |
| `implement-issue` | `software-engineer` |
| `open-pr` | `software-engineer`, pointed at the uncommitted work |
| `review-pr` | `qa-reviewer` |
| `ship-feature` | `orchestrator` |
| `grill-me` | `product-manager`, asked for a grilling session by name |

The `orchestrator` routes a request through every stage in order — product
manager, refinement, optional UX design, software engineer, QA reviewer — and
never skips refinement on substantial work. `instructions-generator` is not a
pipeline stage: it drafts new instruction files, run through
`.github/prompts/create-instructions.prompt.md`.

## Stage agents

| Stage | Canonical document | Claude Code |
| --- | --- | --- |
| Product Manager | [product-manager.md](product-manager.md) | `agent-playbook:pm` |
| Engineering Refinement | [refinement.md](refinement.md) | `agent-playbook:refine` |
| UX Design | [ux-design.md](ux-design.md) | `agent-playbook:ux-design` |
| Software Engineer | [implementation.md](implementation.md) | `agent-playbook:dev` |
| QA Reviewer | [qa-review.md](qa-review.md) | `agent-playbook:qa` |

In Copilot the same stages are the custom agents `product-manager`,
`refinement`, `ux-design`, `software-engineer` and `qa-reviewer`.

## Plugin commands

Two commands ship with the plugin and are not pipeline stages.
`/agent-playbook:init` installs or updates this playbook in a project.
`/agent-playbook:smell` runs a read-only code-smell review and changes nothing.

## Project task skills

Procedures for specific, recurring jobs in this repository go in
`.claude/skills/<name>/SKILL.md`. Unlike the pipeline skills these are
self-contained: the procedure is the skill, and there is no canonical document
to point at because nothing else needs it. List each one here with what it
does and which tools carry it, so a missing copy on one tool is a recorded gap
rather than an accident.

| Skill | What it does | Tools |
| --- | --- | --- |
| `audit-solid-violations` | Reviews a module for SOLID and maintainability issues without changing behavior. | Copilot (`.github/skills/`) |
| `refactor-toward-solid-design` | Makes a focused refactor toward a cleaner, more extensible design. | Copilot (`.github/skills/`) |

## Naming

**`<verb>-<object>`, where the object is the artifact you end up holding.**

`implement-issue` says what you get. A name like `run-pipeline` says only that
a machine ran — not what it produces, and not where it stops. That vagueness is
how one name ends up meaning two different scopes on two tools.

Avoid two names that differ only by a suffix. They do different things and get
picked wrongly under time pressure; a name that is visibly distinct is worth
more than consistency with a convention.

## Adding a platform

1. Create the platform's skill directory.
2. For each row in **Pipeline skills**, add an adapter under the same name that
   loads the canonical document.
3. Add the platform to **How each tool invokes them** and **Stage agents**.
4. Add the adapter location to **Platform adapters** in
   [pipeline.md](pipeline.md).

No workflow content is written or copied at any step. If a platform genuinely
cannot support a skill, say so here and say why.
