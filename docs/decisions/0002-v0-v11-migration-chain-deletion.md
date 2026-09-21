# ADR-0002: Deletion of the v0→v11 Save Migration Chain

**Date:** 2026-09-20
**Status:** Accepted (pre-launch, owner-authorized exception to §8.1)
**Related:** [docs/architecture/storage-and-schema.md](../architecture/storage-and-schema.md) — Forward-Only Schema Migrations; `ARCHITECTURE.md` §5, §8.1

## Context
`SchemaMigrator` (`src/engine/storage/migrator.ts`, a §8.1 protected file) applies registered `N -> N+1` migration steps in sequence to bring a save up to `CURRENT_SCHEMA_VERSION`. Prior to this change, the chain went all the way back to v0, including the legacy single-char tile codec that the earliest steps depended on.

## Decision
The v0 -> v11 step chain and the legacy tile codec it depended on were deleted on 2026-09-20, pre-launch, when no save predating v11 existed outside development. The current schema version is now also the oldest readable one: a save below that floor is refused by `migrate()` (surfacing as a `migration-failed` load outcome, see Load Failure Handling) rather than silently mis-decoded.

## Rationale
No save predating v11 existed outside development at the time of deletion, so the dead migration steps and the legacy codec they depended on were pure maintenance burden with no live saves to protect. `SchemaMigrator` kept its registration and sequencing machinery — verified by `npm run validate:schema` and `migrator.test.ts` — so the next real migration step behaves exactly as it would have before this deletion.

## Consequences
- **Binding invariant going forward:** `CURRENT_SCHEMA_VERSION`'s floor is absolute — there is no migration path below it, by design, and none should be added retroactively. A save below the floor must continue to be refused, never silently mis-decoded.
- This edit to the protected `migrator.ts` had no literal §8.1 exception (it isn't a bug fix, an additive migration step, or a requested Planned Work item). It was authorized as an explicit, narrowly-scoped owner decision, on the same footing as the 2026-09-18 `engine.ts` difficulty-threading exception (see `docs/architecture/content-extensibility.md`, Zone-Tiered Monster Power). Any future deletion of migration history needs the same kind of explicit, narrowly-scoped authorization — it is not covered by the standing §8.1 exceptions.
