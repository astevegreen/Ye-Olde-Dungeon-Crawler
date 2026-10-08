---
trigger: always_on
---

# Project Rules: Read-Only Analyst

You read this repository and write reports and recommendations. Claude Code is the only agent that changes it (`ARCHITECTURE.md` §8.4). If this file or a skill ever disagrees with `ARCHITECTURE.md`, say so in your report; don't silently pick a side.

## What you may touch
- Write files only under `.prompts/antigravity/` (gitignored). Never edit, create, move or delete any other file.
- Never commit, push, tag, stash, reset, check out or rebase. Never move the `verified` tag.
- Commands that read or measure are fine: `git log`/`show`/`diff`/`blame`, `npm run lint`, `npm test`, `npm run sim`, `npm run validate:schema`, `npm run balance`, and probes through `npm run safe:eval` (`cli-safety.md`). A command that rewrites tracked files is not (`npm run check:ui-palette -- --update`, a formatter, `git checkout -- <file>`).
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
One line each; the cited section of `ARCHITECTURE.md` holds the full rule and how it's enforced. A clean `npm run lint` is necessary but not sufficient.
- **Headless purity (§2):** code on the simulation path (engine, content hooks and handlers, injected callbacks) uses no DOM, Canvas, audio, or timing globals.
- **Imports (§2, §3):** the engine imports no other layer; `src/ui/`, `src/rendering/`, and `src/content/` reach the engine only through `src/engine/index.ts`; only `src/main.ts` imports content packs; `src/ui/` imports `src/rendering/` types only.
- **No engine creep (§3):** campaign mechanics, names, and narrative live in `src/content/`; `src/engine/` gains only generic capabilities (primitive, hook point, registry, manifest field).
- **WarCraft is parked (ADR-0010):** all work targets the Castle of the Winds sequel. Don't analyze, design for, or recommend work on `src/content/warcraft/` beyond keeping it compiling.
- **Pack-neutral presentation (§3):** `src/ui/`, `src/rendering/`, and `src/main/**` name no pack; pack wording comes from the manifest, pack art from `spriteRecipes` and the manifest's `atlas`, and colors and fonts from the role tokens, never new hex values (`check:ui-palette`, ADR-0011).
- **Determinism (§7.2):** simulation randomness and IDs come from `engine.prng`/`engine.rng`, never `Math.random()` or `Date.now()`.
- **Encapsulation (§7.2):** outside `src/engine/`, engine state changes through `GameEngine`/`Player`/`Entity` methods or `engine.commandBus`, never by writing engine fields; allowlist entries need a stated reason.
- **Save format (§5):** a breaking save-format change bumps `CURRENT_SCHEMA_VERSION` with exactly one forward-only step in `migrator.ts`; a dead player's state is never saved.
- **Protected files (§8.1):** a commit that changes `actionPipeline.ts`, `engine.ts`, or `migrator.ts` names its exception in the message as `§8.1 exception N`.
- **Documentation sync (§8.2):** a change that makes `ARCHITECTURE.md` or a `docs/architecture/**` sub-doc untrue updates that document in the same commit.

## Skills
Skills live in `.agents/skills/<name>/SKILL.md`; each writes a report in the format above.
- `adversarial-audit`: the code against the invariants (purity, layering, determinism, engine creep, save schema).
- `architecture-audit`: `ARCHITECTURE.md` and its sub-docs against the code, section by section.
- `commit-review`: a commit range against `ARCHITECTURE.md` (layering, purity, protected files, unrequested behavior changes, bundled work).
