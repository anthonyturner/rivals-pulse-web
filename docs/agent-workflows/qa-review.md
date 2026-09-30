# QA and pull-request review workflow

Use this read-only workflow to review a pull request against its linked issue
and the repository's standards.

Write the review for the requester, following the response formatting and
audience rules in [../response-style.md](../response-style.md): plain English
first, technical detail underneath, jargon explained the first time it appears,
and file and line references kept as evidence.

## Process

1. Read `AGENTS.md`, [../rules.md](../rules.md), [tracking.md](tracking.md),
   the files under `docs/stack/` that apply, the pull-request title and body,
   commits, checks, changed files, the full diff, the linked GitHub issue and
   its comments, and any design comment. Acceptance criteria must be read from
   the issue; flag any divergence between the issue and the pull request as a
   blocking finding rather than picking the version that suits the diff.
2. Evaluate every acceptance criterion using evidence from the diff and checks.
3. Review correctness, scope, the stack rules, test coverage of new logic,
   commit format, PR linkage, secrets, debug artifacts, comments
   ([rule 15](../rules.md)), and the `CHANGELOG.md` entry
   ([../changelog.md](../changelog.md)) as applicable. A user-visible change
   with no entry, and no reason given for leaving it out, is a finding.
4. Do not claim a build or test passed without evidence. Mark behavior that
   requires manual testing in the running app.
5. Report blocking findings first with file and line references. Separate
   non-blocking suggestions and manual-verification items.
6. Give a verdict: **approve** only when no blocking finding remains and
   automated evidence is sufficient; otherwise **request changes**.
7. Report **escalation signals** when they occur, as defined in
   [refinement.md](refinement.md): you could not reach a verdict from the
   available evidence, the change is correct in a way you cannot explain, or
   the diff is large enough that you are confident about some files and not
   others. Name the files you are not confident about. "I reviewed it and it
   looks fine" over a diff you could not fully hold is the failure to avoid.
8. Verify the tracking linkage itself: the body carries `Closes #<n>`, and
   the branch is named `<type>/<issue-number>-<short-description>`. A missing
   link is a real finding — without it the merge leaves the issue open.
9. Post the review on the pull request as a comment (`gh pr review <n>
   --comment` or `gh pr comment <n>`). GitHub does not let an account approve
   its own pull request, so the verdict is stated in the comment rather than
   submitted as an approval. Never close the issue — a review verdict is not a
   state change, and closure follows the merge.

The review itself is read-only: do not edit files, commit, push, merge, close
an issue, or broaden the pull request's scope while reviewing. Fixing the
findings and merging are the engineer's next steps, in **Review and merge** in
[implementation.md](implementation.md), and they start only after the review is
posted.
