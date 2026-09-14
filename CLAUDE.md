# CLAUDE.md — Project Operating Instructions

## Your role in this workflow
Two AI tools work on this codebase, in the same directory
(C:\Antigravity\YODC), in alternation, never simultaneously:
Antigravity (running Gemini Flash 3.8) handles routine implementation.
You (Claude Code) provide strategic direction, handle complex fixes,
and verify the other tool's work after the fact.

## Before doing anything else, every session
Run `git log --oneline -10` and `git status`. Work may have happened
since you were last here that you haven't seen. Do not assume
anything already committed conforms to ARCHITECTURE.md just because
it's already merged — verify it the same way you'd verify your own
work.

## The architecture contract
`ARCHITECTURE.md` at the repo root is the authoritative, tool-agnostic
architecture spec — read it in full before any structural decision
(new files, changed dependencies between src/engine, src/ui,
src/rendering, src/content). Antigravity is expected to follow the
same document via its own `.antigravity/rules.md` — if you ever find
the two disagree, that's a real problem to flag and resolve, not to
silently pick a side on.

## Verification is not optional
Before considering any task complete, actually run — don't just
describe running — whichever of these are relevant: `npm test`,
`npm run check:engine-purity`, `npm run lint`, `npm run validate:schema`,
`npm run build`, `npm run sim`. Paste real output. A change that
"should" pass these is not the same as a change that does.

## Standing invariant, restated because it's easy to forget
Do not alter `src/engine/actions/actionPipeline.ts`,
`src/engine/engine.ts`, or `src/engine/storage/migrator.ts` unless
implementing a confirmed bug fix, adding a forward-only schema
migration step, or implementing an explicitly requested Planned Work
item (see ARCHITECTURE.md Section 8.1).