# TypeScript and npm

Read this file before writing TypeScript in Rivals Pulse Coach or running any npm
command. It holds the stack rules the Node/TypeScript pack adds on top of
[../rules.md](../rules.md). Those rules still apply in full; this file only
adds to them.

The rules here are mandatory, not preferences. Where a rule has a reason, the
reason is written next to it, so the next person can tell when it still applies.

## Strict TypeScript

TypeScript's type checker is the cheapest reviewer the project has. Every rule
below keeps it switched on rather than talking it out of an answer.

- **No `any`.** Not written out, not as `as any`, and not as a parameter left
  without a type (an *implicit* any). Use a real type, a union, a generic, or
  `unknown` and narrow it. `any` switches the checker off for everything the
  value touches, not just the line it is on.
- **No implicit returns.** Every path through a function that returns a value
  must return one. A path that falls off the end returns `undefined`, and the
  caller was not told that could happen.
- **Give exported functions and methods an explicit return type.** The
  signature is a contract. An inferred return type changes silently when the
  body changes.
- **Do not assert a shape nothing checked.** `as X`, `as unknown as X` and the
  non-null assertion `!` tell the compiler to trust you. Data from outside the
  program (network responses, files, storage, messages from another window) has
  not earned that trust: validate it, then let the type follow from the check.
- **Treat a caught error as `unknown`.** `catch (e)` can hold anything, not
  just an `Error`. Narrow it (`e instanceof Error`) before reading `.message`.
  Never leave a `catch` empty: log the error or rethrow it.
- **Handle every promise.** Await it, return it, or attach a `.catch`. A
  promise nobody handles fails silently, and an `async` function passed as a
  fire-and-forget callback has no way to report its failure.
- **Use `===` and `!==`**, never `==` and `!=`, which convert types before
  comparing.
- **Use `??` for defaults, not `||`**, unless you really mean to replace `0`,
  `''` and `false` too.
- **Prefer union types and `as const` maps to bare strings and numbers.** A
  typo in a union member is a compile error; a typo in a string is a bug.
- **Make exported constants read-only** (`readonly`, `ReadonlyArray`,
  `as const`) so a caller cannot mutate shared data by accident.
- **Read the clock through something a test can control.** Logic that calls
  `Date.now()` or `new Date()` directly cannot be tested at a fixed time.

The compiler can enforce most of this. Keep these on in `tsconfig.json`:
`strict`, `noImplicitReturns`, `noFallthroughCasesInSwitch`,
`noImplicitOverride` and `useUnknownInCatchVariables` (part of `strict`). Do
not switch one off to make an error go away; fix the code the error points at.

## npm and `node_modules`

`node_modules` is the folder npm fills with the project's installed packages.
`package.json` lists what the project depends on, and `package-lock.json` (the
*lockfile*) pins the exact version of every package, so every machine installs
the same tree.

- **Never add, upgrade or remove a dependency unless the task asks for it.**
  A dependency is a long-term cost the requester has not agreed to. If a change
  seems to need one, say so and let the requester decide.
- **Install with `npm ci` and nothing else.** It installs exactly
  what the lockfile says and cannot change `package.json` or the lockfile, which
  is what makes it safe to run without asking. Everything that *can* change them
  is off limits — for npm: `install`, `i`, `add`, `uninstall`, `remove`, `rm`,
  `update`, `upgrade`, `install-test`, `link`, `prune`, `rebuild` and
  `dedupe`, and `ng add` and `ng update` in an Angular project — and likewise
  every other package manager's equivalents.
- **Every worktree gets its own `node_modules`, installed with
  `npm ci`.** A *worktree* is a second checkout of the repository,
  kept under `.claude/worktrees/`, so one task can work without disturbing
  another. A new worktree has no `node_modules`; install in it before building.
- **Never hand-repair `node_modules`, and never link it.** Do not write,
  extract or copy files into it, and do not point one checkout's
  `node_modules` at another's with a symlink or junction. A linked folder is one
  physical directory shared by every tree that points at it, so a "fix" in one
  tree silently changes every other tree. npm is also not safe when two
  processes write to the same `node_modules` at once, which is how a shared one
  gets corrupted.
- **If a package is missing, or the lockfile will not install, stop and report
  it.** Do not work around it. A branch whose lockfile no longer matches its
  `package.json` is usually stale: rebase it on `master`
  rather than running an install that rewrites the lockfile until the error
  goes away.

The project's `.claude/settings.json` denies the forbidden npm commands and any
write under `node_modules`. The rules are written down here as well because a
denied command is a dead end, and knowing why saves the next agent from trying
to work around it.

## Logging and debug output

- **Log through the project's logger, not raw `console.log`.** If the project
  has a logging utility, use it: it is where formatting, levels and "quiet in
  production" live. Name it in `docs/tech-stack.md`. If there is no logger yet,
  do not scatter `console.log` calls as a substitute; raise it instead.
- **Leave no debug artifacts behind**: no stray `console.log`, no
  commented-out code, no temporary debug hooks. Git already keeps old code, so
  commenting it out keeps nothing that is not already safe.

## Commit messages and the commitlint issue-reference trap

Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat: ...`, `fix: ...`, `docs: ...`). The `commit-msg` hook runs
*commitlint*, which checks every message against `.commitlintrc.json` and
rejects the commit if it does not match.

**Never write a bare `#<number>` in a commit body.** It fails the hook, and the
error points at the wrong thing.

`.commitlintrc.json` extends `@commitlint/config-conventional`, whose parser
scans the message line by line for issue references shaped like `#123`. The
moment any body line contains one, the parser treats every line from there on
as the *footer* (the trailer block at the end of the message), including
ordinary prose. It then checks that prose against footer-only rules, such as
`footer-leading-blank`, and fails, even when the real trailer is well formed.

The error, usually "footer must have leading blank line", is misleading. It is
not about the `Closes #n` or `Co-Authored-By:` trailer. It is about body prose
that was swept into the footer by mistake. Line length and line count have
nothing to do with it; the only trigger is a bare `#<number>` outside the real
footer.

**The fix:** write the reference in words ("issue 187") when the body needs to
mention it. Keep `#<number>` for the trailer line (`Closes #187`) and for the
pull-request title and body, where GitHub's linking is what matters.

Check a message before committing for real:

```sh
npx commitlint --edit <path-to-message-file> --verbose
```

When it fails, look for a bare `#<number>` in the body first. That is the cause
far more often than anything else.

## Verify

Run `npm run build` (there is no lint command yet), plus `npm test` when
the change touches logic, before calling a change complete. A type error is a
failed build, not a warning to note and move past.
