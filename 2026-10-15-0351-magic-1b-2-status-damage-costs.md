# Handoff: magic plan 1b-2, statuses, damage, costs, cast time
2026-10-15 03:51 UTC · branch main · HEAD a2550d84 · tree clean

## Goal
Plan session 1b-2 (P-28, spell building blocks) from the owner's "Magic implementation plan 15 Oct 2026" Notion page, phase 1: https://app.notion.com/p/Magic-implementation-plan-15-Oct-2026-3faeb012942f8151966add5a1946da01. Engine-only spell mechanics, each tested on fixture-pack spells; players see nothing. Done = committed, pushed, gates green.
- **Cleanse** one harmful status, or all, as a spell effect. A cure action exists for potions and choices (`src/engine/actions/spell-actions.ts:458-465`), not spells.
- **Hand over:** move the caster's harmful statuses to a target; `src/engine/status/statusManager.ts` gets a transfer.
- **Pierce:** a resisted hit lands as neutral.
- **Best element:** a hit with several elements lands as the one the target resists least (`affinityTo`, `getMultiplier` in `src/engine/magic/elements.ts:101-116`). The forge's engine half; a forged element is already saved as `GrimoireState.forged` (a2550d84).
- **HP costs:** spells can cost current HP (blood magic), and Thrift lowers HP costs too. Today `vitalityCost` burns max HP (`spell-actions.ts:146-207`) and no spell costs current HP.
- **Swift:** a cast can cost ¾, ⅔ or ½ of a turn, at `spell-actions.ts:222`. Durations still tick once per action, as with haste (`engine.ts:985-986`), so the protected `engine.ts` stays untouched. The Swift stat's table is `castTimeByStep`; `resolveSlotStats` already yields `castTimeFraction` (`src/engine/magic/grimoires.ts:188`).

## Done
- a2550d84 feat(magic): carry old saves over to the three grimoires (1a-2; 1a-1 is e167da4e)
- Uncommitted: none

## Next
1. Read `src/engine/magic/spellPipeline.ts` (effect dispatch) and `src/engine/magic/castNumbers.ts`; add cleanse and hand-over first (`statusManager.ts` transfer).
2. Pierce and best element in `elements.ts`/the damage path; HP cost and Swift in `spell-actions.ts` + `magic/types.ts`. Thrift's cost multiplier comes from `resolveSlotStats(...).costMultiplier`.
3. Tests per mechanic on fixture-pack spells (`tests/fixtures/fixture-pack/index.ts:81`). Gates: `npm run gate-stamp -- run lint test`, sim, validate:schema, build; no Playwright. Commit with `Requested:` quoting the plan ask, push in the background.

## Decisions
- Thrift stacks multiplicatively: two steps = 36% off — owner: "two steps of Thrift should stack 36% off". Apply the same to HP costs.
- 1b-1 may run at the same time in another session; both touch `spellPipeline.ts` and `magic/types.ts`, so whichever lands second merges main first.
- Volatile Energy and `vitalityCost` removal is a later phase (blood magic rework), not this session: add current-HP cost beside them.

## Read first
- `src/engine/actions/spell-actions.ts:140` — cost payment and cast time (to :230)
- `src/engine/magic/elements.ts:101` — affinity and multiplier
- `src/engine/status/statusManager.ts` — add the transfer here
- `src/engine/magic/grimoires.ts:188` — `resolveSlotStats`: Thrift and Swift numbers
- `tests/fixtures/fixture-pack/index.ts:81` — fixture spells to extend

## Verification
- gate-stamp lint test, sim, validate:schema, build, pre-push (3 browsers): green on a2550d84
Resumed: 2026-10-15 03:55 UTC
