# ADR-0002: Deletion of the v0→v11 Save Migration Chain

**Date:** 2026-09-20
**Status:** Accepted (pre-launch; §8.1 exception 4, owner-authorized — see [ADR-0005](0005-owner-authorized-exception-and-agent-workflow.md))
**Related:** [docs/architecture/storage-and-schema.md](../architecture/storage-and-schema.md) — Forward-Only Schema Migrations; `ARCHITECTURE.md` §5, §8.1

## Context
`SchemaMigrator` (`src/engine/storage/migrator.ts`, a §8.1 protected file) applies registered `N -> N+1` migration steps in sequence to bring a save up to `CURRENT_SCHEMA_VERSION`. Prior to this change, the chain went all the way back to v0, including the legacy single-char tile codec that the earliest steps depended on.

## Decision
The v0 -> v11 step chain and the legacy tile codec it depended on were deleted on 2026-09-20, pre-launch, when no save predating v11 existed outside development. The current schema version is now also the oldest readable one: a save below that floor is refused by `migrate()` (surfacing as a `migration-failed` load outcome, see Load Failure Handling) rather than silently mis-decoded.

## Rationale
No save predating v11 existed outside development at the time of deletion, so the dead migration steps and the legacy codec they depended on were pure maintenance burden with no live saves to protect. `SchemaMigrator` kept its registration and sequencing machinery — verified by `npm run validate:schema` and `migrator.test.ts` — so the next real migration step behaves exactly as it would have before this deletion.

## Consequences
- **The floor is absolute:** there is no migration path below `CURRENT_SCHEMA_VERSION`'s floor, by design, and none is added retroactively; a save below it is refused, never silently mis-decoded. The binding statement of this rule lives in `ARCHITECTURE.md` §5.
- This edit to the protected `migrator.ts` was owner-authorized rather than a bug fix, additive step, or requested Planned Work item. At the time §8.1 had no such exception; ADR-0005 added it as exception 4, and any future deletion of migration history needs the same explicit, narrowly scoped authorization.
