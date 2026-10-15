# Handoff: magic 3b (the altar trade)
2026-10-15 18:22 UTC · branch main · HEAD ca3aeaaa · tree clean

## Goal
Phase 3a "Allies and endings" is finished. Next is Phase 3b, "The trade" (`.prompts/plan-page.txt:384-394`): the captive-for-spell altar trade, blood spells costing HP, frith spells costing Seiðr, the four old blood spells retired (a save map handles them), Volatile Energy and corruption's number removed from the engine, and corruption shown as a mark. Players see this phase. Read memory `magic-review-2026-10-13` and `grid-draugr-decisions` first.

## Decide first
- A friendly summon slain by a monster still drops its loot table, a small free-loot exploit (raised foes already drop nothing, `src/engine/magic/raise.ts`). Should ordinary summons also drop nothing? — recommend: yes, empty `lootTable` and `xpValue` 0 in `executeSummonEffect`, because a summon is borrowed and was never the hero's kill.

## Done
- ca3aeaaa status endings, pacify and raising the slain: `src/engine/status/endings.ts` (`StatusEnding`: expire / struck / slain, `consumesBearer`, `data.x/y` centre), `StatusHandler.onEnd`, `SummonEffect.bears`, built-in `pacified`, `rises_when_slain` and `risen` (`statusHandlers.ts`), `magic/raise.ts`, cotw bosses resist both (`src/content/cotw/monsters/index.ts`). Bug fixed: a pack's `expireMessage` for `summoned` dropped the removal (now in `onEnd`, no protected file touched).
- Tests: `src/engine/status/__tests__/endings.test.ts`, `src/engine/ai/__tests__/pacifyRaise.test.ts`, a cotw boss test in `monsterRoster.test.ts`.
- Uncommitted: none.

## Next
1. Confirm the push of ca3aeaaa landed (`git status -sb` shows no "ahead"); if not, `git push` (pre-push reruns sim, build, Playwright).
2. Read `.prompts/plan-page.txt:384-394` and plan 3b; start from `src/content/cotw/hostageRitual.ts:285-398` (the captives).

## Model
Opus at high thinking: 3b removes engine systems (Volatile Energy, corruption numbers) and touches saves (a retired-spell map), so it spans engine, content and storage.

## Decisions
- Draugr-call curses a living foe, which rises on death; a blow breaks pacify and allies leave pacified foes alone — owner picked both recommendations (memory `grid-draugr-decisions`).
- P-31 stays in ARCHITECTURE.md §9 with one item left: a summon's hits carry its cast's borrowed lends (`deliverLends`, `summonHits`, `src/engine/magic/spellPipeline.ts:289`).

## Read first
- `.prompts/plan-page.txt:384-394` — 3b spec
- `src/content/cotw/hostageRitual.ts:285-398` — the captives

## Verification
- lint + test: green on ca3aeaaa (3105 unit); `npm run sim` green; pre-push still running when this note was written.
Resumed: 2026-10-15 18:27 UTC
