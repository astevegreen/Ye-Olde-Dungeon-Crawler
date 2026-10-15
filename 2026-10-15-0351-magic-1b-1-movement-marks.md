# Handoff: magic plan 1b-1, moving creatures and marks
2026-10-15 03:51 UTC · branch main · HEAD a2550d84 · tree clean

## Goal
Plan session 1b-1 (P-28, spell building blocks) from the owner's "Magic implementation plan 15 Oct 2026" Notion page, phase 1: https://app.notion.com/p/Magic-implementation-plan-15-Oct-2026-3faeb012942f8151966add5a1946da01. Engine-only spell effects, each tested by casting a fixture-pack spell; players see nothing. Done = committed, pushed, gates green.
- **Push N / pull N** as spell effects, reusing the knockback engine (`src/engine/combat/impulse.ts:45-241`): into a wall stuns, over a chasm a foe falls, bosses take half. A pull stops beside the caster instead of splatting.
- **Swap places** with a creature in sight. Today swapping exists only for walking into allies (`src/engine/actions/movement.ts:85`).
- **Aimed landing tile** for teleports (Odin's sight steering Phase Door). A random 2-tile blink already works: a teleport effect with range 2.
- **Mark:** a status that shows the creature through walls (`src/engine/fov/sensing.ts`) and makes it take 10% more damage. Statuses get a damage-taken hook (`src/engine/status/statusHandlers.ts:11-31`, `src/engine/entities/entity.ts:218-247`).

## Done
- a2550d84 feat(magic): carry old saves over to the three grimoires (1a-2; 1a-1 is e167da4e)
- Uncommitted: none

## Next
1. Read the effect primitives in `src/engine/magic/spellPipeline.ts:102-170` and the effect types in `src/engine/magic/types.ts:95-145`, then add push/pull first (smallest reuse of `impulse.ts`).
2. Add swap, aimed landing, then mark with the status damage-taken hook; one test per effect, cast from a new fixture-pack spell in `tests/fixtures/fixture-pack/index.ts` (`FIXTURE_SPELLS`, :81).
3. Gates: `npm run gate-stamp -- run lint test`, `npm run sim`, `npm run validate:schema`, `npm run build`; no Playwright needed (no presentation). Commit with `Requested:` quoting the plan ask, push in the background.

## Decisions
- 1b-2 may run at the same time in another session; both touch `spellPipeline.ts` and `magic/types.ts`, so whichever lands second merges main first. Effects are generic primitives (§3 No Engine Creep): no cotw names in the engine.
- `entity.ts` damage path and `statusHandlers.ts` are not §8.1 protected; `engine.ts` and `actionPipeline.ts` are — avoid them.

## Read first
- `src/engine/magic/spellPipeline.ts:102` — where effect primitives dispatch
- `src/engine/combat/impulse.ts:45` — knockback: wall stun, chasm fall, boss halving
- `src/engine/status/statusHandlers.ts:11` — handler shape the damage-taken hook joins
- `src/engine/fov/sensing.ts` — how creatures are sensed through walls today
- `tests/fixtures/fixture-pack/index.ts:81` — fixture spells to extend

## Verification
- gate-stamp lint test, sim, validate:schema, build, pre-push (3 browsers): green on a2550d84
Resumed: 2026-10-15 03:54 UTC
