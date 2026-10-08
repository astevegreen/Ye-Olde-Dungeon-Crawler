# ADR-0009: Attunement NPC Named From the Manifest in Engine Messages (Protected-File Change)

**Date:** 2026-09-30
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §3 (Pack-Neutral Presentation, No Engine Creep), §8.1 (exception 4); [ADR-0008](0008-rune-of-return-attunement-engine-change.md); [content-rune-of-return.md](../architecture/content-rune-of-return.md)

## Context
A pack-neutrality sweep of `src/ui`, `src/rendering` and `src/main` left three engine messages that named cotw's rune-smith, "Thrain", as a plain string: the chronicle entry in `absorbRuneOfReturn` (`src/engine/engine.ts`), the dormant-rune refusal in `magic/runeOfReturn.ts`, and the dormant rune's description in `quest/dungeonArc.ts`. `check:engine-creep` misses them because it matches declared identifiers, not display names. Under any other pack, these messages sent the player to an NPC that does not exist.

## Decision
The owner authorized fixing these engine-side leaks on 2026-09-30 ("Fix the engine-side leaks; I give you permission"). The only protected-file change is in `engine.ts`: the chronicle text calls the new `attunementNpcName(this.manifest)`, plus the import it needs. `attunementNpcName` lives in `magic/runeOfReturn.ts`. It returns the `town.npcs` entry named by `runeOfReturn.attunementNpcId`, or "the smith" when there is none. The UI's `resolveBranding().runeSmithName` uses the same function.

This does not authorize any further `engine.ts` edits.

## Alternatives Considered
- **Emit the message from outside `engine.ts`.** Rejected: `absorbRuneOfReturn` records the discovery inline. Moving it out to an event subscriber would change when it is recorded, which is a larger engine change than replacing one string.

## Consequences
- The three messages follow the active pack's own attunement NPC.
- `src/ui/__tests__/packNeutralSource.test.ts` now fails if a pack's townsfolk name appears in engine source outside comments.
