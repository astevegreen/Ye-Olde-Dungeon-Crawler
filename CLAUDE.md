# CLAUDE.md — Project Operating Instructions

## Your role in this workflow
Two AI tools work on this codebase, in the same directory
(C:\Antigravity\YODC), in alternation, never simultaneously:
Antigravity handles routine implementation. You (Claude Code) provide
strategic direction, handle complex fixes, and review everything that
lands. ARCHITECTURE.md §8.4 is the binding workflow: review happens
after commit, attribution and `Requested:` trailers, and the `verified`
review marker.

## Before doing anything else, every session
1. Run `git status` and `git log --oneline verified..HEAD`. If the
   `verified` tag is missing, say so and review from the last commit
   you can confirm was reviewed.
2. Review every listed commit without a `Co-Authored-By: Claude`
   trailer the way you'd verify your own work: against ARCHITECTURE.md,
   with the relevant gates run. Being merged proves nothing.
   - A `Requested: "..."` trailer quotes the owner. Treat that behavior
     as intended: check it is done correctly, don't re-litigate it.
   - Flag behavior changes with no request behind them, bundled
     unrelated work, and anything that breaks the architecture.
3. Once everything in the range is reviewed and green, run
   `git tag -f verified HEAD`. Report anything you couldn't clear
   instead of moving the tag past it.

## The architecture contract
`ARCHITECTURE.md` at the repo root is the authoritative, tool-agnostic
architecture spec — kept small enough to read in full every session,
before any structural decision (new files, changed dependencies
between src/engine, src/ui, src/rendering, src/content, src/main).
It carries its own routing table pointing to `docs/architecture/**`
sub-docs (content extensibility, storage/schema, simulation/input,
quality gates) and `docs/decisions/**` ADRs — consult the sub-doc a
change actually touches, per that table. Antigravity follows the
same document through `.agents/rules/project-rules.md` (always loaded;
instructions anywhere else are not) — if you ever find the two
disagree, or either disagrees with `ARCHITECTURE.md`, that's a real
problem to flag and resolve, not to silently pick a side on.

## Verification is not optional
Before considering any task complete, actually run — don't just
describe running — whichever of these are relevant: `npm run lint`
(this already runs `tsc --noEmit`, `check:engine-purity`,
`check:engine-encapsulation`, `check:engine-creep`, `check:ui-palette`, AND `knip` — don't
invoke those separately), `npm test`, `npm run sim`, `npm run validate:schema`, `npm run build`. Paste real output. A change that "should" pass
is not the same as a change that does.

Routine for every commit that touches presentation:
1. `npm run gates`: all of the above, then `npx playwright test`. The
   pre-commit hook runs only lint and tests, and Playwright normally
   runs only at the owner's push, yet it has caught regressions the
   unit tests missed.
2. CSS or layout changed: capture the HUD before and after with the dev
   server running (`OUT=.prompts/<dir> node .prompts/menus-audit.mjs
   1366 g00`). Menu screenshots don't show it, because the scrim hides
   the HUD.
3. A visible label changed: grep `e2e/` and `.prompts/` for the old
   text. Capture scripts click through `.prompts/play.mjs` (`startRun`,
   `button`, case-insensitive); use those, not new hard-coded matches.

## Tooling gotchas
- Line endings: `.gitattributes` pins LF, and the working tree was
  rewritten to LF on 2026-10-02. For scripted multi-edits use
  `.prompts/edit.mjs` (`\n` in a pattern matches either ending; it
  throws on a miss), or the Edit tool.
- Escaping: bash heredocs, `node -e` and template literals nested in an
  edit script mangle backticks and `${…}`. Write code to its own file
  with the Write tool, or use the Edit tool. `edit.mjs` reads every `\n`
  in a pattern as a line break, so it can't match or write the two
  characters `\` `n` inside a source string (dialog text, say): edit
  those lines with the Edit tool.
- Inline styles (static markup in `index.html`, `el.style.x = …`) beat
  stylesheet rules. Remove the inline style; don't add `!important`.
- knip fails on unused exports. Delete what a refactor orphans.
- `git rm` stages at once, so a later `git add X && git commit` takes
  the deletion with it. Delete with plain `rm` and stage per commit.
- No Python on this machine. `test-results/` and `dist/` can't be read.

## Standing invariant, restated because it's easy to forget
`src/engine/actions/actionPipeline.ts`, `src/engine/engine.ts`, and
`src/engine/storage/migrator.ts` change only under an ARCHITECTURE.md
§8.1 exception, named in the commit message as `§8.1 exception N`.
Exception 4 (owner-authorized) comes only from the owner's own words
in the task. Prefer a fix outside these files when one exists.

## The WarCraft pack is parked
All work targets the Castle of the Winds sequel (ADR-0010). Don't build,
screenshot, design for or extend `src/content/warcraft/`, and don't
plan work around a second pack. It stays only because it compiles and
serves as the second-pack test fixture: when a shared change breaks it,
make the smallest fix that restores `tsc` and the tests. Pack-neutral
presentation (§3) still binds.

## No ephemeral markdown at the repo root
Working prompts, task notes, and other scratch markdown for a single
piece of work go in `/.prompts/` (gitignored) or outside the repo —
never as a new `.md` file at the repo root. The root holds exactly
`ARCHITECTURE.md` and `CLAUDE.md`; keep it that way.