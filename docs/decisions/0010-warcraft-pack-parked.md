# ADR-0010: The WarCraft Pack Is Parked Until the Castle of the Winds Sequel Is Complete

**Date:** 2026-09-30
**Status:** Accepted (owner decision)
**Related:** `ARCHITECTURE.md` §1, §2, §3 (Pack-Neutral Presentation, No Engine Creep), §7.2; [quality-gates.md](../architecture/quality-gates.md)

## Context
Every change to shared code paid for two packs: `build:all` in the pre-push hook and CI, a second deploy bundle, and handoffs that asked for a WarCraft visual check on each design pass. The owner is building one product, the *Castle of the Winds* sequel, and wants every session spent on it: "I want to cease all development of the Warcraft content pack for now. My intention is to focus solely on the Castle of the Winds sequel until it is complete and then move to other content packs."

## Decision
`src/content/warcraft/` is **parked**:
- **Not built or released.** The pre-push hook, `ci.yml` and `deploy.yml` build only the cotw bundle. `npm run build:all` is removed; `npm run build:warcraft` stays for the day the pack is unparked, and nothing runs it.
- **Not developed or designed for.** No new WarCraft content, art, tokens, visual checks or screenshots. Design work targets cotw only.
- **Kept compiling and kept as a test fixture.** `tsc` still type-checks it, and about 20 engine and UI tests use it as the second pack that proves engine genericity; `check:engine-creep` and `packNeutralSource.test.ts` still read its identifiers and proper nouns. When a shared change breaks it, the fix is the smallest one that restores the build and tests, never new pack work.

Pack neutrality (§3) stays binding. The owner will add other packs after the sequel, and they must still arrive without engine changes.

## Alternatives Considered
- **Delete the pack (git history keeps it).** Rejected for now: about 20 tests would need a new second-pack fixture, and the neutrality checks would lose the only second pack they read, so cotw-only assumptions could drift into shared code before the next pack arrives.
- **Keep building it but stop touching it.** Rejected: a broken WarCraft bundle would still block every push and deploy, which is the cost this decision removes.

## Consequences
- The published `warcraft.html` drops out of GitHub Pages on the next deploy.
- A shared change can break the WarCraft bundle without any gate noticing. `tsc` and the tests still catch type and behavior breaks; bundle-level breaks surface only when the pack is unparked.
- **Unparking:** restore the WarCraft steps in `deploy.yml`, a two-pack build in the pre-push hook and `ci.yml`, and the §1/§2 wording, then fix whatever the bundle check finds.
