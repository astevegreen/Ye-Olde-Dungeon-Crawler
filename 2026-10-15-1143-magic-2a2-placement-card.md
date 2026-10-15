# Handoff: magic 2a-2, placement card left
2026-10-15 11:43 UTC · branch magic-grimoire · HEAD f829eef9 · tree clean

## Goal
Plan phase 2, step 2a-2 (`.prompts/plan-page.txt:291`): quick bar boosted numbers, run-start stat pick, one placement card for every way of learning a spell (tablet, Loki's Cairn, altar, rite; later a stone): "place it, forget one to make room, or not now". Branch merges to main once 2c passes `npm run gates`.

## Decide first
- Where does a spell go on "not now" with every slot full? (a) lost for that source: a tablet stays unread, an altar/rite/Cairn spell is gone, no save change; (b) kept as a pending offer saved with the hero and reopened from the Spellbook, one optional save field — recommend: (b), because rites and altars are one-shot and losing a boss's lesson is a bad surprise; the field is additive (§8.1 exception 2 only if the migrator must change).
- With a free slot, does the card still open? recommend: no, the spell is placed in the first free slot as today and the log says where; the card opens only when the grimoires are full (less friction, same choice).

## Done
- 25c20c1b quick bar: boosted cost beside base, unplaced spell reads "place" and is not cast (`src/ui/quickSpellsBar.ts`, `src/main.ts` castOrTargetSpell).
- f829eef9 title screen "First stat" row, Power preselected; `createCharacter` option `firstGrimoireStat` (`src/engine/storage/profile-manager.ts`).
- Not pushed: 2a-2 is unfinished; push when the card lands.

## Next
1. Get the two answers above.
2. Engine: callers of `learnSpell` (`src/engine/magic/spellPipeline.ts:239`, `altars.ts:216`, `killRites.ts:101`, `actions/choiceAction.ts:151`) call `Player.learnSpellResult` (`entities/player.ts:549`), whose outcome `full` is today silently dropped. Record the offer on the player and report it to presentation.
3. UI: one card (modal on `ModalStackManager`) with place / forget one / not now; build from `spellbookGrimoires.ts` (`pendingStatPicks`, forget flow in `spellbookTab.ts renderForget`); call engine actions, never write engine state.
4. Test with the fixture pack; run `npm run gates`, then `visual-check` the card; push.

## Model
Opus at high thinking — the offer touches four engine call sites and possibly save format.

## Decisions
- Quick bar: base cost struck through beside the boosted one; an unplaced spell is shown dashed and not cast (log line instead) — chosen because the plan says casting unslotted spells goes away.
- First stat goes to the first pending axis of the first open grimoire, set at creation (no action recorded) — chosen because no hero exists on the title screen.

## Verification
- lint + 3069 tests: green on f829eef9 (pre-commit gate-stamp).
- Playwright, sim, build: not run.
Resumed: 2026-10-15 11:54 UTC
