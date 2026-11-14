# UX design workflow

Use this optional stage after the work item exists in GitHub and before
implementation, when the change contains a material user-facing design
decision.

This stage is product/UX design, not software design. It owns what the user
sees and does: wireframes, layout, interaction flow, and accessibility. It does
not own how the change is built. Architecture, interfaces, data flow, and
technology choices belong to the engineer who implements them, as
**Technical approach** in [implementation.md](implementation.md) — the same
split as a product designer and an engineer in a delivery team.

A decision is material when it introduces a new UI pattern or component type,
changes information architecture or a user-facing interaction flow, affects
readability or performance-sensitive rendering, or has meaningful
accessibility implications. Skip this stage for routine, localized, or
already-designed UI work (e.g. reusing an existing shared component, minor
copy or spacing changes).

Write the design handoff for the requester, following
[../response-style.md](../response-style.md): plain English first, technical
detail underneath, jargon explained the first time it appears, and file and
line references kept as evidence.

## Process

1. Read `AGENTS.md`, [../rules.md](../rules.md), every file under
   `docs/stack/` that covers UI, the complete work item (the GitHub issue with
   its comments), and the existing components and styles around the proposed
   change.
2. Look for shared components, patterns, and theme values to reuse before
   proposing new ones.
3. Compare viable UX approaches and select the smallest design that satisfies
   the acceptance criteria without contradicting the project's existing
   conventions (its styling system, naming scheme, and component patterns).
4. Produce an implementation-ready design containing:
   - a wireframe for each affected screen or component, as described in
     **The wireframe** below, with a structured description beside it;
   - new or reused shared components, with rationale for anything new;
   - visual design details (spacing, theme values, states: empty, loading,
     error, hover/focus);
   - accessibility notes (keyboard operability, focus order, ARIA roles and
     labels, color contrast against WCAG 2.1 AA);
   - performance notes when the change touches a performance-sensitive view
     (render cost, update frequency, avoidance of layout thrash — the browser
     recalculating layout over and over);
   - alternatives and tradeoffs;
   - manual verification steps a reviewer can follow in the running app.
5. Return the design to the caller. This stage cannot post to GitHub, so the
   caller posts the handoff as a comment on the GitHub issue before
   implementation.

## The wireframe

The default is a **text wireframe** in the handoff: a box drawing in a fenced
code block, one per screen or component, laid out the way the component tree
will nest, followed by a structured description of each region. Name every
region for the thing it stands for (`order-summary`, `status-badge`), because
those names are what the engineer reads and reuses.

A text wireframe is only as good as its labels. Mark each region's content,
its states, and anything that scrolls, truncates or wraps; show real sample
content rather than "lorem ipsum", because a design that works only with
short strings does not work.

## Optional: draw the wireframe in Paper

Use this section only when the project uses Paper (paper.design) and its MCP
server is available in the session. Otherwise skip it; the text wireframe
above is the complete deliverable.

A text wireframe inside an issue comment is the only copy of itself, and it
lives in the thread. Paper is a design canvas whose files are HTML and CSS; its
desktop app runs a local MCP server — Model Context Protocol, the plug that
lets an agent talk to another application — which this stage can use to draw
the wireframe as a real artboard the requester can open afterwards.

The stage works in **the design file the requester is looking at**. Paper can
open and create other files, but a stage that opens a different file moves the
canvas out from under the person watching it, so leave those tools alone.

1. **Call `get_guide` with topic `paper-mcp-instructions` first.** Paper's own
   server requires this before its other tools, and it carries craft rules this
   document does not repeat. Follow it wherever it is more specific.
2. **Check the connection.** Call `get_basic_info`. It returns the file name,
   the page name, the existing artboards and the file's design tokens. If the
   call fails, or the Paper tools are not present in this session at all, take
   the fallback below — do not retry, and do not ask the requester to open the
   app mid-run.
3. **Post the design brief before the first write.** Paper's guide requires it
   and it is part of the handoff: the mood, the palette with roles, the type
   scale, and one sentence of direction. Use the file's existing design tokens
   (`get_tokens`) where they exist rather than inventing values.
4. **Create one artboard per design run**, named `<issue number> <short
   title>` — for example `142 Saved filters`. The issue number is what makes it
   findable from GitHub months later. Size it to the real target screen or
   window, not a convenient rectangle. Set the artboard's own height to
   `fit-content` once the content is in, rather than guessing a number.
5. **Write the wireframe with `write_html`, in small pieces** — roughly one
   visual group per call, nested the way the component tree will nest. The
   requester watches it appear in real time, and a single flat block is not a
   wireframe: it cannot be inspected, renamed or rearranged. Name every layer
   for the thing it stands for. For repeated rows, build one and
   `duplicate_nodes`, then `set_text_content` on the copies.
6. **Use the real theme values.** Paper cannot resolve the project's CSS
   variables, so take the concrete values from the project's stylesheets and
   carry the variable name beside them (`#1f6feb` — `--color-accent`). Seeding
   them once as Paper design tokens makes every later artboard consistent. A
   wireframe in arbitrary greys tells the engineer nothing about contrast.
7. **Look at what you actually drew.** Call `get_screenshot` and read it, after
   each section and again at the end. `write_html` reports success for markup
   that lays out wrongly, so the screenshot is the only evidence the design is
   what you intended. Write the critique down and fix it on the canvas, rather
   than describing the intended version in the handoff.

   One trap worth knowing: a text node given `white-space: pre` computes its
   width as `max-content` and silently ignores a pixel width, so table columns
   that should share a lane hug their text instead. Set `white-space: normal`
   with the width.
8. **Touch nothing else in the file.** Create your own artboard and work inside
   it. Never move, restyle or delete a node outside it — the requester's other
   work is in that file. Re-running for the same issue replaces the contents of
   that issue's artboard instead of adding a second one.
9. **Call `finish_working_on_nodes` when done.** Paper's server requires it;
   without it the canvas keeps showing the stage as still working.
10. **Report the names.** Return the Paper file name and the artboard name to
    the caller, who carries them into the issue comment. Without them the
    drawing is unfindable, which is the whole point of drawing it.

**When Paper is unreachable**, say so in one line in the handoff — "Paper was
not reachable, so the wireframe below is text only" — and produce the text
wireframe instead. The planning run continues and completes. A closed app is
not a reason for a design stage to fail, and the requester can re-run the stage
later with the app open.

The two causes look identical from inside the stage and neither is worth
diagnosing here: the desktop app is closed, or the agent session started before
the Paper MCP server was registered, in which case its tools do not exist in
that session and only a restart adds them.

## What this stage may write to

Nothing, by default. It is read-only with respect to the repository, git and
GitHub: do not edit files, create branches, commit, push, open pull requests,
write to a work item, or perform product-management work. The design reaches
the issue only because the caller posts it.

The one exception is the optional Paper canvas. Writing there is genuinely
writing, which is why it is stated here as a single named exception rather
than left to inference. Within Paper the stage is still additive — its own
artboard, created by it, and no other node in the file.
