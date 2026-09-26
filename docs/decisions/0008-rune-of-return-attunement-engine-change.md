# ADR-0008: Rune of Return Awakening at the Rune-Smith (Protected-File Change)

**Date:** 2026-09-26
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §8.1 (exception 4); [ADR-0005](0005-owner-authorized-exception-and-agent-workflow.md); [content-rune-of-return.md](../architecture/content-rune-of-return.md); commit `a8fb886`

## Context
The owner asked that the Rune of Return not work when found, but be carried to town so the Rune-Smith can teach the hero to use it. Antigravity implemented this in `a8fb886` and cited §8.1 exception 4, but the request quoted in the commit did not name a protected-file change and no ADR was written, so review flagged it.

`a8fb886` changes three places in `src/engine/engine.ts`:
- `interactWithNpc`: speaking to the pack-declared attunement NPC while carrying an unawakened rune awakens it (`absorbRuneOfReturn`); an awakened hero gets the existing free recharge.
- `handlePlayerAction`: the check that marked the rune discovered the moment it was carried is removed.
- `absorbRuneOfReturn`: grants full charges, and records a chronicle discovery.

## Decision
The owner authorized the change as implemented, on 2026-09-26, after being offered a rework that avoided `engine.ts` and choosing to "just proceed as-is". Scope is exactly the three changes above. It is not a licence for further `engine.ts` edits to the rune mechanic.

## Alternatives Considered
- **Keep the change out of `engine.ts`.** Rejected: the discovery check runs after every player action inside `handlePlayerAction` and treats any carried rune as awakened, so the dormant stone would need a separate item class (with its own serialization) that the check cannot see. The engine's own attunement dialogue would then print "you carry no Rune of Return" before an awakening, unless movement code intercepted the NPC talk and duplicated the engine's handling. That is more code and a worse boundary than three small engine hunks.

## Consequences
- `a8fb886` is an exception-4 change on record.
- Known gap, deliberately left: `diagnostics.spawnItem` (`engine.ts`) still absorbs a `RuneOfReturnItem` immediately, bypassing the Rune-Smith. It is a triage tool, and closing it needs its own authorization.
