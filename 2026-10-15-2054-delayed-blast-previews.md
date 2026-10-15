# Handoff: magic 4b-2, delayed blast and aim previews
2026-10-15 20:54 UTC · branch main · HEAD faeca343 · tree clean

## Goal
Phase 4b "New shapes" (`.prompts/plan-page.txt:451-461`, P-33), the owner's "Proceed with the next phase". 4b-1 (the shapes) is in; 4b-2 is the delayed blast and an aim preview for every shape, then retire P-33. Engine + presentation, so `npm run gates` applies.

## Done
- faeca343 `SpellDefinition.shape` (`cone|nova|square|wall|outAndBack`, `src/engine/magic/types.ts`), tiles in `castGeometry` (`castTrace.ts`: `area`, `back`), cast routing in `spellPipeline.ts` `executeTargetedSpell` (shapes first; out-and-back dispatches effects again on `geo.back`), `traceProjectile(..., passesCreatures)`. Fixture spells `breath clap shroud cairn hammer`; tests `src/engine/magic/__tests__/spellShapes.test.ts`.
- 9c444ba7 P-32 retired; e42b7b75 landing on surfaces.
- Uncommitted: none

## Next
1. Delayed blast: an effect that applies a status on the caster with `data.x/y` (the aim) and an ending `on: ['expire']` (`src/engine/status/statusHandlers.ts:49-66`, `endings.ts:25-64` `goOff`). Gaps to close: the ending's `radius` is fixed per handler (Area must grow it), it hits foes only (no `tiles` for laid rubble), and one status per type per bearer (both blasts must land, see Decisions).
2. Intent overlay draws pending player blasts as a second source beside monster wind-ups (`src/rendering/intentOverlay.ts:32-51`, `dangerTiles` at :148).
3. Aim previews: `src/rendering/targeting-overlay.ts:334-345` draws `geo.burst` via `getAreaOfEffectTiles`; add `geo.area` and `geo.back`. Also `:152-158` (the flight preview) and `shortBurstCentre` (:510).
4. Playback: the engine emits a `burst` over a shape's bounds (`boundsOf` in `spellPipeline.ts`); a cone draws as a square burst. Decide whether a tile-list burst is worth adding.
5. `npm run gates`, visual-check the aim preview, commit, push; then retire P-33 in ARCHITECTURE.md §9 (separate commit).

## Model
Opus 5.5 at high thinking — engine status changes plus presentation across several files.

## Decisions
- Two delayed blasts from one caster in the same turn (Swift-cast Rockfall twice) both land, each its own pending blast — owner: "yes to both"
- Nova, square and wall shapes strike through walls as Fireball's blast does; only the cone stops at walls — owner: "yes to both"
- Sizes come from `areaOfEffect`, so the Area stat (`castNumbers.ts:61`, only when > 0) grows every shape; for `square` it is the side, for the others a radius — chosen so 4×4 Shroud is expressible.
- Out-and-back hits the creature at its turning tile twice, like every other creature on its path (Hammer-Throw "8 + 8").
- Wall direction snaps to the nearest of eight; lends deliver once, on the outbound hits.

## Read first
- `src/engine/magic/castTrace.ts` — the shapes as built
- `src/engine/status/endings.ts:25-64` — the ending a delayed blast reuses
- `src/rendering/targeting-overlay.ts:320-380` — the preview to extend

## Verification
- `npm run gate-stamp -- run lint test`: green on faeca343 (3169 tests); `validate:schema` green.
- pre-push for faeca343: running when this note was written; check `git status -sb` is level with origin.
