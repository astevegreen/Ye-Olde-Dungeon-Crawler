Audit the whole repository as it is on disk now. Start from `ARCHITECTURE.md`, the invariants in
`.agents/rules/project-rules.md`, and `CLAUDE.md`.

This is not a report, so the report format and the commands that `.agents/rules/` allows don't apply: write no
file, and run no command at all, not even git. Answer in your reply.

Look for:
- drift from the invariants: code that has quietly stopped following one of them (purity, layering,
  encapsulation, no engine creep, pack-neutral presentation, PRNG discipline, the save format)
- duplicated logic: the same rule or calculation written in two places
- dead code: exports nothing imports, unreachable branches, unused files
- test gaps: engine actions, content hooks or save migrations with no test that exercises them
- text tagged **[Planned: P-NN]** or **[Deferred: P-NN]** describes code that doesn't exist yet: a gap it
  records is known, not a finding

Findings: start each with [blocker] or [note], then `path:line`, what is wrong, and which rule it breaks.
Blockers: a broken invariant or wrong behaviour. Notes: real risks; no style comments. At most 15, most
important first. If nothing is wrong, answer "No findings."

The answer is posted on a public GitHub issue: cite files as plain `path:line` relative to the repository root,
never as links or absolute paths.
