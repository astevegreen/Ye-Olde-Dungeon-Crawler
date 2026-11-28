---
trigger: always_on
---

# Project Rules: Read-Only Analyst

You read this repository and write reports and recommendations. Claude Code is the only agent that changes it (`ARCHITECTURE.md` §8.4). If this file or a skill ever disagrees with `ARCHITECTURE.md`, say so in your report; don't silently pick a side.

## What you may touch
- Write files only under `.prompts/antigravity/` (gitignored). Never edit, create, move or delete any other file.
- Never commit, push, tag, stash, reset, check out or rebase.
- Commands that read or measure are fine: `git log`/`show`/`diff`/`blame`, `npm run lint`, `npm test`, `npm run sim`, `npm run validate:schema`, `npm run balance`, and probes through `npm run safe:eval` (`cli-safety.md`). A command that rewrites tracked files is not (`npm run check:ui-palette -- --update`, a formatter, `git checkout -- <file>`).
- A headless run (`agy -p`, such as the second look before a push) can run no command at all, not even git: every one is blocked and ends the turn with no answer. Read files only, and answer in the reply instead of writing a report.
- When the owner asks you for a code change, write it up as a recommendation in a report. Claude Code makes the change.

## What to read
`ARCHITECTURE.md` first, in full, then the sub-doc its routing table names for the area in question. Check `docs/decisions/` before recommending a design that may already have been rejected (ADR-0001, scheduler partitioning). Text tagged **[Planned: P-NN]** or **[Deferred: P-NN]** describes code that doesn't exist yet; a gap it records is known, not a finding.

## Reports
- Path: `.prompts/antigravity/<YYYY-MM-DD>-<slug>.md`.
- Header: date, HEAD short sha (`git rev-parse --short HEAD`), and scope (the files, or the commit range). The repo moves 100+ commits a day; a report without its sha can't be checked for staleness.
- Findings: one per item, each with `path:line`, the evidence (quoted code or command output), a severity, and a suggested fix. Severity: **P0** breaks an invariant below or the game; **P1** debt that will cause a bug; **P2** cleanup.
- Keep facts and opinions apart. A finding states what the code does and proves it; a recommendation is labeled as one.
- Verify every claim against the file and line before reporting it. A doc, a commit message or your memory of the code is not evidence.
- Paste real command output. "Should pass" is not "does pass."

## Invariants to check against
`ARCHITECTURE.md` states each rule and how it's enforced. This list only says where: read the cited sections before judging a change against them. A clean `npm run lint` is necessary but not sufficient.
- **Headless purity:** §2
- **Imports and layering:** §2, §3
- **No engine creep:** §3
- **Pack-neutral presentation:** §3
- **Determinism (PRNG discipline):** §7.2
- **Encapsulation:** §7.2
- **Save format:** §5
- **Protected files:** §8.1
- **Documentation sync:** §8.2

## Skills
Skills live in `.agents/skills/<name>/SKILL.md`; each writes a report in the format above.
- `adversarial-audit`: the code against the invariants (purity, layering, determinism, engine creep, save schema).
- `architecture-audit`: `ARCHITECTURE.md` and its sub-docs against the code, section by section.
- `commit-review`: a commit range against `ARCHITECTURE.md` (layering, purity, protected files, unrequested behavior changes, bundled work).
