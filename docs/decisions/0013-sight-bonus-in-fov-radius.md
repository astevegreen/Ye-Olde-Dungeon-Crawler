# ADR-0013: A Worn or Perk Sight Bonus Joins the FOV Radius (Protected-File Change)

**Date:** 2026-10-04
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §8.1 (exception 4); [ADR-0005](0005-owner-authorized-exception-and-agent-workflow.md); [content-progression-scaling.md](../architecture/content-progression-scaling.md) (Perks)

## Context
The owner approved the Saga perk list (Q51 "A", 2026-10-04), whose level-10 Wayfarer gives "sight +1". The hero's sight radius is computed in one place, `GameEngine.updateFov` in `src/engine/engine.ts`, a §8.1 protected file: the engine's `fovRadius` plus the pacts' `fovRadiusModifier`, floored at 2, before any status's `perceptionRadius` override (blindness and the like). Nothing a hero wears or holds reaches that sum, so Wayfarer shipped in `1a3f450` without its sight. The question went to the owner as Q56.

## Decision
The owner authorized it on 2026-10-04: "Wayfarer's "sight +1" needs a one-line change in engine.ts, a protected file. I authorize it as a §8.1 exception 4 with an ADR."

Scope is exactly one line of `engine.ts`: `updateFov` adds `this.player.sightBonus` to the base radius. Everything else lives outside the protected file:
- `ItemModifier.sightBonus` (`items/modifiers.ts`), a numeric effect in the shared item and perk vocabulary.
- `Player.sightBonus`, the sum of that field over what the hero wears and the perks it holds (`sumWorn`).
- cotw's Wayfarer carries `sightBonus: 1`.

A status's `perceptionRadius` override still wins over the widened radius, as it wins over the pacts' modifier. The bonus also widens the awakening and bestiary checks, which `updateFov` bounds by the same radius (§6). This is not a licence for further `engine.ts` edits to sight or perception.

## Alternatives Considered
- **Keep Wayfarer without sight** (Q56 option B: evasion +10% and perception from twice as far). Rejected by the owner.
- **Route the bonus through the pacts' aggregated mutators**, which `updateFov` already reads. Rejected: perks and items are not pacts, and `PactManager` would have to learn about the hero's paperdoll, which mixes two systems to dodge a one-line change.
- **A status with a `perceptionRadius`.** Rejected: that field forces a radius (the most restrictive wins), it cannot add one, and a permanent perk is not a status.

## Consequences
- Any item family or perk can now widen sight by data (`sightBonus`), with no further engine change.
- The F2 simulation tab's "FOV radius" row still shows the engine's base `fovRadius`, not the hero's sight.
