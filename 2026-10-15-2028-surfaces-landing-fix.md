# Handoff: magic 4a-2, landing on surfaces, then retire P-32
2026-10-15 20:28 UTC · branch main · HEAD ffda2b7c · tree clean

## Goal
Phase 4a "Surfaces as data" (`.prompts/plan-page.txt:439-450`, P-32). Left: entering effects at the end of slides, knockbacks and teleports, then retire P-32. Engine work.

## Done
- ffda2b7c a lightning hit in water shocks its target once: `SurfaceGrid.terrainAt` (laid water counts as shallow), `triggerElementalReaction(..., struck)` skips the struck creature in the pool shock; spell and melee-affix paths pass it, pool base is the spell's raw hit
- Wave-1 check: none of the six spells (plan `:480-500`) needs a pull, blink or mark on entering, so step 3 of the old note adds nothing; say so in the P-32 commit
- Uncommitted: none

## Next
1. Failing test first: a creature knocked back onto fire takes no `enter` (e.g. in `src/engine/combat/__tests__/` or `groundReactions.test.ts`).
2. Add `SurfaceGrid.landOn(engine, entity)`: `handleEntityStep(entity, x, y, 0, 0, engine)`, penalty ignored (no slide, since dx=dy=0, so ice can't chain; no move cost, the move wasn't its own).
3. Wrap `applyImpulse` (`src/engine/combat/impulse.ts:45`): when `distanceTraveled > 0`, target alive and not `fellInChasm`, call `landOn`, then `killed = !target.isAlive()`. This covers knockbacks, pulls and ice slides (`surfaceGrid.ts` slide calls applyImpulse).
4. Call `landOn` after `moveEntity` in `SpellPipeline.teleportToAim`, `teleportEntity` and both creatures in `swapPlaces` (`spellPipeline.ts:958-1035`).
5. Gate, commit, push; then delete P-32 from ARCHITECTURE.md §9, add it to the retired IDs (separate commit).

## Model
Opus 5.5 at medium thinking — a specified cross-file change with a test first.

## Decisions
- A struck wader in laid water now takes lightning 200% (and fire 50%), as in shallow water — chosen so both waters behave alike, as freeze already treats them.
- Landing triggers only the final tile, not each tile passed — the note's "end of" wording; a shove across fire doesn't burn per tile.
- Surface deaths credit no killer (`harm` passes `undefined`), as stepping does today; out of scope.

## Read first
- `src/engine/combat/impulse.ts:45-244` — where the wrapper goes
- `src/engine/surfaces/surfaceGrid.ts:219-250` — `handleEntityStep`
- `src/engine/magic/spellPipeline.ts:958-1035` — swap and teleports

## Verification
- `npm run gate-stamp -- run lint test`: green on ffda2b7c (3154 tests). First run failed `itemSprites.test.ts` bake once under Playwright load; passed alone and on rerun.
- pre-push for ffda2b7c: running when this note was written; check `git status -sb` shows main level with origin. 3cd05bf1 pushed green.
