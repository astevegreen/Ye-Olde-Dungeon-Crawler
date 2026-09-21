# ADR-0003: `jarnvidrExposureHandler` Replaced by `giantBlood.ts`

**Date:** 2026-09-18
**Status:** Accepted
**Related:** [docs/architecture/content-extensibility.md](../architecture/content-extensibility.md) — Level-Scaled Elemental Resistance, Zone-Tiered Monster Power

## Context
`stats/levelScaledResistance.ts` (`resolveLevelScaledResistance`/`applyLevelScaledElementalMitigation`) was built to resolve a numeric mitigation fraction from an ascending `{level, resistance}` step curve — the first real consumer of `calculateAttribute`'s long-reserved but previously-unused `'elementalResistance'` attribute key. Its one consumer was `cotw/hazards.ts`'s `jarnvidrExposureHandler`, an environmental hot/cold damage-over-time tick.

## Decision
On 2026-09-18, `jarnvidrExposureHandler` was removed. The mechanic it implemented (environmental exposure damage) was replaced by a felt bonus instead of a debuff — see the Zone-Tiered Monster Power content system and `cotw/giantBlood.ts` — which does not use level-scaled resistance at all.

## Rationale
The debuff framing (environmental damage-over-time) was replaced with a bonus framing (a felt buff tied to zone-tiered monster power) as a design change, not a bug fix. `resolveLevelScaledResistance`/`applyLevelScaledElementalMitigation` were deliberately never wired into `Entity.takeElementalDamage` or the categorical `elementalResistances` affinity system combat already uses, so removing their one consumer could not regress combat.

## Consequences
- `stats/levelScaledResistance.ts` remains in the engine as unused-but-legitimate generic capability. No other content pack consumes it today.
- Do not delete `levelScaledResistance.ts` as "dead code" without re-verifying it has no consumer at the time — it is intentionally-idle generic capability, not an oversight.
