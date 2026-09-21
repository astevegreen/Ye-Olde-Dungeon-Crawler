# ADR-0001: Active/Dormant Scheduler Partitioning — Evaluated, Not Adopted

**Date:** 2026-09-13 (benchmarked); reverted 2026-09-15
**Status:** Rejected (evaluated on evidence, not merely deferred)
**Related:** [docs/architecture/simulation-and-input.md](../architecture/simulation-and-input.md) — Bounded Simulation Scoping; `ARCHITECTURE.md` §6

## Context
`EnergyScheduler` selects the next actor to act from a single flat entity list scoped to the active floor (`ARCHITECTURE.md` §6, Bounded Simulation Scoping). Turn selection is therefore linear in the active floor's actor count, including actors that are dormant (sleeping, out of the player's vicinity). An active/dormant partition — splitting `EnergyScheduler`'s entity storage into separate active and dormant lists so turn-selection cost no longer depends on the dormant population — was proposed to remove that dependency.

## Decision
The partition was implemented and benchmarked, then reverted. `EnergyScheduler` continues to use a single flat entity list.

## Rationale
- The throughput difference was well below human-perceptible thresholds: sub-millisecond per turn at every tested population up to 500.
- The "~30 per floor" figure then cited as a realistic population was not derived from the spawner. `npm run sim` now measures realistic populations from generated floors, and they fall below every population tested in the benchmark — so the benchmark's conclusion (no perceptible win) stands even under the corrected population figures.
- That original benchmark sampled each population once and measured only sleeping monsters — a narrower measurement than `npm run sim`, which is population-anchored, multi-sample, and adds an awake-monster floor. `npm run sim` supersedes it.
- The added complexity was judged not worth it: six new call sites had to keep two lists in sync with `aiState`, and one of them desynced and produced a real bug.

## Consequences
- The one-off benchmark scripts from this evaluation (`run-bench.cjs`, `run-bench-internal.ts`) were removed on 2026-09-15: they could only measure the post-revert single-list scheduler, and `run-bench.cjs` no longer ran under it. They remain in git history (last committed in `3d71469`).
- This is a rejection on evidence, not a deferral. Re-attempting the same partition without new evidence (e.g. a population profile that actually exceeds what was tested) would be repeating a measured negative result. Review project history around 2026-09-13 for the full benchmark data before re-attempting.
