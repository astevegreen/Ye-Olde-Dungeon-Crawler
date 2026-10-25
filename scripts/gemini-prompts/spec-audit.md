Audit the sprint task spec(s) in the material file before any code is written. Claude wrote them from the
backlog in `docs/sprint.md`. Judge them against `ARCHITECTURE.md`, the invariants in
`.agents/rules/project-rules.md`, `CLAUDE.md` and `docs/sprint.md`. For each issue, read the files and lines
listed under "Read first", and only those.

This is not a report, so the report format and the commands that `.agents/rules/` allows don't apply: write no
file, and run no command at all, not even git. Answer in your reply.

Look for:
- gaps: behaviour the goal implies that no acceptance criterion covers
- contradictions with `ARCHITECTURE.md` or its invariants: purity, layering, encapsulation, no engine creep,
  pack-neutral presentation, PRNG discipline, the save format, `§8.1` protected files
- a product decision the spec makes that `docs/sprint.md` does not (balance feel, scope, a save-format break, a
  new mechanic, a name or placement the design leaves open)
- a cited `path:line` that no longer says what the spec claims
- acceptance criteria that can't be tested, or that a test could pass without the behaviour existing
- missing edge cases: a reload or save round trip, older saves, a hero already past the floor, another way the
  player reaches the same behaviour (other dialogs and prompts, recasting, a new floor)
- tasks too big for one fresh session: more than about 300 changed lines

Answer per issue, starting each section with "## #<number>". Under it, findings: start each with [blocker] or
[note], then `path:line` (or the spec section), what is wrong, and which rule or acceptance criterion it breaks.
Blockers: a gap or contradiction that would make the built change wrong. Notes: real risks and missing edge
cases; no style comments. At most 10 per issue, most important first. If nothing is wrong, answer
"No findings." under that issue's heading.

The answer is posted on a public GitHub issue: cite files as plain `path:line` relative to the repository root,
never as links or absolute paths.
