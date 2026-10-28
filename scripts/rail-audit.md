Audit one change to this game's repository before it is pushed. It touches the repository's rails: what stops a
bad change from reaching players unnoticed. The material file holds the request the change was made for, the rail
files it touches, and the diff. Judge the diff only; read other files only where the diff is unclear, at the paths
it names.

The rails: Claude Code hooks and the sprint guard (`.claude/hooks/`), `.claude/settings*.json` (permissions and the
hooks they wire), the sprint skills and agents that wire the guard, git hooks (`.githooks/`), CI workflows
(`.github/`), the gates (lint, tests, sim, schema, build, Playwright, the `scripts/check-*` scripts and their
allowlists and baselines, and the configs and `package.json` scripts that run them, such as the sim and the schema
check), the reviewer and the second look with the rules they review against (`.agents/rules/`), the CI watch, the
deploy's scope, and the sprint's queue rules and push lock (`scripts/sprint/`).

Answer one question: does this change loosen, bypass or disable any check, guard, gate, hook or required review?
Loosening includes a check that runs less often, on fewer files, browsers or pushes; a wider allowlist, pattern or
exception; a refusal turned into a warning, a prompt or nothing; a failure that now passes; a permission rule that
allows more or asks less; a hook or guard unwired; a lock that covers fewer paths; a step skipped under some
condition; and a required review or audit dropped or made advisory. A change that only adds or tightens a check,
or only rewords, does not loosen.

This is not a report: write no file, and run no command at all, not even git. Answer in your reply. Its first line
is exactly `LOOSENS: yes` or `LOOSENS: no`. After `yes`, one line per loosening: `path:line`, what is loosened,
and what it would no longer catch. After `no`, one line saying why not.
