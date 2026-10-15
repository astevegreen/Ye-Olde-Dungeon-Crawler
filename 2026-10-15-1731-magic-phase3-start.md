# Handoff: magic Phase 3 start (allies and endings, 3a)
2026-10-15 17:31 UTC · branch main · HEAD e7fc756c · tree clean

## Goal
Phase 2 (grimoires, lends, forge, 2a–2c) is finished, merged and deployed: `main` = `magic-grimoire` = e7fc756c. Next is Phase 3, "Siphon Altar and blood magic" (`.prompts/plan-page.txt:341-400`), starting with 3a, the invisible engine work: allies and endings. Done for 3a = engine gates green, no player-visible change.

## Decide first
- Owner's go for 3a — recommend: start 3a-1 now, because 3a is invisible and has no open questions in the plan.

## Done
- Phase 2 complete: 603b2315, 918f1a5f, d97154b7 and e7fc756c (Eihwaz, the poison Essence-Rune) closed 2c. Visual check on g03/g09b/g19 found no issue (Forging card sits below the fold in a scrolling column; populated state covered by `src/ui/__tests__/spellbookForging.test.ts`).
- Uncommitted: none.

## Next
1. Read the 3a spec (`.prompts/plan-page.txt:372-385`). Start with the failing test the plan asks for: a friendly summon must fight foes and never hit its own side (`src/engine/actions/combat.ts:86-101`).
2. 3a-1: ally routine with nearest-foe targeting (`src/engine/ai/aiRegistry.ts:517-637`, `behaviorTree.ts`); monsters pick an ally or decoy (`targetSelection.ts`, `src/engine/ai/stealth.ts`).
3. 3a-2: raise a slain foe as a temporary ally, pacify (bosses resist), and endings that run when a status or summon ends or its bearer is struck, run by `src/engine/status/statusManager.ts:110-164`.
4. Then 3b (the trade, blood spells cost HP, the mark, standing) and 3c (the reason, Sonnet).
5. `main` is protected-file territory: `engine.ts` and `actionPipeline.ts` changes need a §8.1 exception; prefer keeping changes outside them.

## Model
Opus at high thinking — 3a is engine design and a cross-file change (AI, combat, status manager) with a fixture-pack test per capability.

## Decisions
- Phase 2 merged to `main` and deployed — owner: "Yes"
- No soak runs until the magic work lands; measuring magic is Phase 7 (memory `soak-after-magic`).

## Read first
- `.prompts/plan-page.txt:341-400` — Phase 3 spec
- `ARCHITECTURE.md` §4 and §8.1 — action pipeline and protected files
- `src/engine/magic/spellPipeline.ts:592-650` — where spell effects are built
- `src/engine/status/statusManager.ts:110-164` — status ending hooks

## Verification
- `npm run gates`: green on e7fc756c (3080 unit, 33 Chromium); pre-push 91 passed across three browsers.
