# Response formatting and audience

Read this before writing anything a person will read: a chat response, a
GitHub issue or pull-request body, a review comment, or the output of any
stage of the agent pipeline.

Write for the requester, who reads these responses to make decisions, not for
another engineer. Lead with what the change or finding means in ordinary
words, then give the technical detail underneath — the detail is kept, never
dropped.

- **Plain English first.** State the outcome in ordinary words, then the
  mechanism. "The settings page and the background worker are two separate
  processes, so they can't just share a variable — we'd have to pass the value
  between them" beats "cross-process state requires an explicit propagation
  mechanism".
- **Explain a term the first time you use it.** Debounce, idempotent, blast
  radius, migration — one short clause in parentheses is enough. Do not drop a
  repository-specific name (a module, a service, a stored setting) without
  saying what it does.
- **Keep the technical detail.** Readable is not the same as thin. Keep
  every fact, name and number, then say it so that someone who knows very
  little about the project can just about follow it. The target is clear, not
  simple: if a sentence can be read two ways, rewrite it until it can only be
  read one way.
- **Gloss any word a reader may not know.** Long or unusual words are fine;
  just put a plain equivalent beside the first use. Write "vacuous (proves
  nothing)", "concurrently (at the same time)", "precedes (happens before)".
  This covers ordinary English, not just technical terms: the requester should
  never have to look up a word to follow a sentence about their own project.
- **Short sentences, active voice.** Say "this would break the login form",
  not "a regression in the login form would be introduced".
- **Link named symbols to their definitions.** When a response references a
  function, method, class, or other named symbol in this repository, link it
  using Markdown link syntax (e.g. `[functionName](path/to/file#L42)`)
  instead of wrapping it in backticks. This lets the reader jump straight to
  the definition. Plain prose, file paths without a specific symbol, and code
  blocks are unaffected by this rule.
- **File and line references stay.** They are evidence, not prose — put them
  in parentheses after the plain-English claim so a reader can skip them.
- **Give the title with every issue or pull request number.** Each time a
  response mentions an issue or pull request by number, put its real GitHub
  title beside the number, so the reader knows what it is at a glance: "#123,
  Let players filter heroes by role". A number repeated in the same paragraph or list item needs the
  title only once. Give the title alone; do not copy in the issue's body. Look
  the title up rather than guessing. A `Closes #123` line is exempt, because
  GitHub reads it, not a person. Commit messages follow **Issue references in
  commits** in [agent-workflows/implementation.md](agent-workflows/implementation.md),
  and changelog entries and tracking lines keep the format their workflow doc
  gives them.

[agent-workflows/refinement.md](agent-workflows/refinement.md) extends these
rules for the refinement assessment, the one stage whose entire output is its
reasoning.
