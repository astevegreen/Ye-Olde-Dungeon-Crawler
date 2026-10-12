# Handoff: aligned loot ramps with depth (fix plan Session 5)
2026-10-12 18:04 UTC · branch main · HEAD 2a0a6bdd · tree clean

## Goal
Session 5 of the Notion page "Ideas, bugs, and playtest notes" (Fix plan toggle). Owner's note: "In earlier levels of the game, items drops should be more skewed towards normal items, and aligned items should steadily drop more frequently as the player descends ... Aligned items should still drop in early levels, but it should just scale over time to be more common the deeper you go."
Plan: aligned share of eligible loot ~15% on floor 1, ~40% by floor 10, ~55% from floor 20 down; bad (Negative) families still start at floor 3. Done = committed, soak/balance measured, pushed, Session 5 marked "done and pushed" on Notion.

## Decide first
- Total aligned items per run: the ramp gives fewer on floors 1–9 and more below 10 than today's flat ~40%. A run that dies early finds fewer; a deep run finds more. — recommend: let the total follow the ramp (no rebalancing to keep ~110/run), because "rewarding for the player to keep going deeper" is the point.

## Done
- Sessions 1–4 pushed (last: da9307cd paperdoll fit, 67a8c4e8 rune hints, 93fae446 rune pouch, c4fe3838 rune drop rate).
- 2a0a6bdd notes.sh list shows .md notes only (push was running when written).

## Next
1. Today the share is flat: `rollItemFamily` (`src/engine/items/modifierRoller.ts:120`) adds `perGame / itemsPerGame` per family (cotw: 275 items, Positive 60, Negative 40, Chaotic 10 = 40%). Add a generic depth curve to `ItemFamilyConfig` (e.g. `alignedShareByFloor?: (floor) => number` scaling all families' shares, relative proportions kept); absent = today's behavior, so the fixture pack and other tests' RNG streams are unchanged. Engine change is generic (§3 No Engine Creep).
2. cotw curve in `src/content/cotw/itemFamilies.ts:16`: 0.15 at floor 1 → 0.40 at 10 → 0.55 at 20+, linear between. Keep `minFloor: 3` on the Negative families (:130, :154, :182) — check what their share does on floors 1–2 (today it falls to Normal).
3. Update tests: `src/content/cotw/__tests__/itemFamilies.test.ts:24-55` (asserts 60/40/10, floor-20 shares), `lootVolume.test.ts:79-85` (per-game counts). Add a test of the share at floors 1, 10, 20.
4. Measure: `scripts/balance-report.ts` (items per family per floor) before and after; `npm run sim`. Consider a short soak (soak skill) if the bot's gear changes a lot.
5. Gates, commit, push, mark Notion, report player-visible changes.

## Decisions
- Plan numbers (15/40/55, bad from floor 3) are from the owner's Notion fix plan, settled 12 Oct.
- Total aligned items per run follows the ramp, no rebalancing — owner: "Follow the ramp (Recommended)"

## Read first
- `src/engine/items/modifierRoller.ts:113` — the roll
- `src/content/cotw/itemFamilies.ts:1` — families, perGame, doc comment says Negative 45 but data sums to 40 (lootVolume.test also says 45): reconcile
- `src/content/cotw/__tests__/itemFamilies.test.ts:24` — share assertions
- `src/engine/dungeon/lootSpawner.ts:92` — call site

## Verification
- da9307cd: full gates green (2930 tests, sim, schema, build, 33 Chromium), pre-push 3 browsers green
Resumed: 2026-10-12 18:08 UTC
Complete: ddd8a2d9 pushed, full gates + 3-browser pre-push green; Notion Session 5 marked done.
