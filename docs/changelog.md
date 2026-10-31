# Changelog

`CHANGELOG.md`, at the root of the repository, tells a person what changed
between versions of Rivals Pulse Coach, in words they can read without opening a
diff. The commit history and pull requests hold the detail; they are written
for reviewers. The changelog is written for someone asking "what's new?".

It follows [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). If
the project had a changelog in another format before the playbook was
installed, that format wins: match it rather than mixing two.

## When a change needs an entry

A pull request adds its entry itself, in the same change, under
`## [Unreleased]`. Nobody reconstructs the list from the history afterwards.

It needs one when someone using the project would notice the change: new
behavior, changed behavior, something removed, a fixed bug, a security fix, a
deprecation.

It does not when nobody outside the pull request could tell: a refactor, a
test, a CI tweak, a documentation typo, a dependency bump with no visible
effect. Say so in the pull request instead ("No changelog entry: internal
refactor"), so a reviewer can tell an omission from a decision.

## How to write one

- **One line per change, written for the user.** Say what they can now do or
  what behaves differently, not what the code does: "Export files open
  correctly in Excel", not "Write a BOM in `exportCsv()`".
- **Link the pull request** at the end of the line: `([#42](<pull-request URL>))`.
- **File it under one category**, adding the heading if the section has none
  yet, in this order:

  | Heading | For |
  | --- | --- |
  | `### Added` | New features. |
  | `### Changed` | Changes to existing behavior. |
  | `### Deprecated` | Features that will be removed in a later release. |
  | `### Removed` | Features removed in this release. |
  | `### Fixed` | Bug fixes. |
  | `### Security` | Vulnerability fixes. |

```markdown
## [Unreleased]

### Added

- Save the current filter set and reapply it later ([#42](https://github.com/owner/repo/pull/42)).

### Fixed

- Export files open correctly in Excel ([#57](https://github.com/owner/repo/pull/57)).
```

Never edit or delete an entry under a released version. A correction is a new
entry.

## When two pull requests add an entry

Two pull requests adding lines under the same heading conflict with each other.
The resolution is always the same: keep both lines. Never drop one to make the
conflict go away.

## Cutting a release

A release is a person's decision, not an agent's. When one is cut, the
`## [Unreleased]` entries move under a new heading carrying the version and
the date, `## [1.4.0] - 2026-03-01` (ISO 8601), and an empty
`## [Unreleased]` goes back on top. The version follows
[Semantic Versioning](https://semver.org/): anything under `Removed`, or a
`Changed` entry that breaks existing use, means a major version.
