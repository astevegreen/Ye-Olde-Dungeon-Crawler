# ADR-0015: Planes and Reactive Substances Removed

**Date:** 2026-10-07
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §4 (Pipeline Coverage, Failure Isolation), §8.1 (exception 4), §9 (P-27); review 2026-10-06 R-pipe-25 and the S4 dead-subsystem list

## Context
Two engine systems were built and ran every turn, but nothing in the game used them:
- **Planes.** `PlaneManager` (`src/engine/world/planeManager.ts`) kept per-floor plane state and ran a `plane-drift` environmental update every turn; `PlanePortalAction` and `AstralProjectionAction` (`src/engine/actions/planeActions.ts`) moved an entity between planes. No input, menu, AI or pack issued either action, so nothing ever left the `physical` plane and the drift had nothing to drift. Saves carried a `planes` record.
- **Reactive substances.** `SubstanceGrid` (`src/engine/environment/substanceGrid.ts`) held a per-cell bitmask (flowing fluid, ignited, …) with a `substance-tick` environmental update that spread and damaged. No production code ever wrote a substance (`addSubstance` had only test and schema-validator callers), and its tick's budget could starve under load. Saves carried each map's `substances`.

`ARCHITECTURE.md` §4 listed both among the per-turn environmental updates as if they were live, and the 2026-10-06 review flagged each as dead code that would carry latent defects the day someone wired it.

## Decision
On 2026-10-07 the owner chose to delete both (answer to "Which should I delete?": "Planes, Substances, Hook registration API"). This is a named, narrowly scoped change to a protected file, `src/engine/engine.ts`, under §8.1 exception 4: remove the `PlaneManager` field, constructor option and `plane-drift` update, and the `substances` getter and `substance-tick` update. Nothing else in `engine.ts` changes.

- **Kept:** the plane id plumbing that every lookup threads through — `Entity.planeId`, the plane-qualified spatial keys in `GameMap`, `planeId` in saved entities — so no save changes shape and no lookup changes behaviour. Everything stays on `physical`.
- **Saves:** the `planes` and per-map `substances` fields are no longer written; an older save that has them loads, and they are ignored. No schema version change (`migrator.ts` untouched).
- **Docs:** §4 no longer lists plane drift or substances among the environmental updates; `validate:schema` no longer round-trips a substance.

The hook registration API (`registerPrimitive`/`registerGlobalHook`), deleted in the same decision, touches no protected file and is recorded in its own commit. Locked doors and bashing, which the owner kept, are parked as §9 P-27.

## Alternatives Considered
- **Keep both, marked parked** (as locked doors are). Rejected by the owner for these two: they cost a tick every turn and a save field each, and neither has a design that would use it.
- **Delete the plane id plumbing as well.** Rejected: it would change the spatial keys and every saved entity, for no gain while everything sits on one plane.

## Consequences
- Two environmental updates fewer per turn; saves shrink by the substance grid of every stored floor.
- Reviving either system means rebuilding it against today's engine, starting from this ADR and the deleted files in git history (`git log --diff-filter=D -- src/engine/world/planeManager.ts src/engine/environment/substanceGrid.ts`).
