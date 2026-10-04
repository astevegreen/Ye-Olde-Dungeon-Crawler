# ADR-0012: Item Families Are Pack Data; the Engine Keeps the Vocabulary and the Roller

**Date:** 2026-10-04
**Status:** Accepted (owner decision, Q1 "A", Q20 + Q33 "B", Q21 "A")
**Related:** `ARCHITECTURE.md` §3 (No Engine Creep, Content Extensibility Model); [content-extensibility.md](../architecture/content-extensibility.md); tracker item 2.2; audit D1 › N39

## Context
The seven alignment families (Blessed, Enchanted, Holy, Cursed, Hexed, Unholy, Chaotic) existed since `8cd5825` as `ItemModifier` data applied in combat, spell damage and mana cost, but nothing in play ever put one on an item: the roller was called only from a test, and the templates — tier names ("Sanctified", "of the Templar", "Doom-touched"), numbers and floor bands — were a constant table inside `src/engine/items/modifierRoller.ts`. Players met an older `Item.quality` system instead: `enchanted` (any +N, or 36 catalog items flagged so), `cursed` (four catalog items that bind) and `artifact`.

The owner chose the families as the real item system: "A" to Q1 (the seven families become the real item system, as pack data; +N stays a separate roll; the live quality labels go; the four cursed catalog items stay as cursed relics), with 60 Positive, 45 Negative and 10 Chaotic items a game and no curses before floor 3 (Q20, Q33).

Tier names and numbers are campaign flavor and balance, which §3 puts in `src/content/`. The engine rule is "add a generic, reusable capability that content packs then use", so the question was where the line falls.

## Decision
- **The engine keeps the vocabulary and the mechanics.** `ModifierCategory` stays the closed set of seven family ids and `ModifierAlignment` the three polarities. Presentation colors by them (`--ui-rarity-*` role tokens), the merchant prices by polarity, the temple cleanses by `binds`, and combat applies modifier *fields* (`meleeDamageMultiplier`, `tagBonuses`, `damageTakenMultiplier`, …) whatever family carries them. A family id is roguelike vocabulary like `undead`, not a pack-declared identifier.
- **The pack supplies everything else** through `GameContentManifest.itemFamilies` (`ItemFamilyConfig`, `src/engine/items/modifierRoller.ts`): per family its alignment, `perGame` count, first floor (`minFloor`), whether it `binds`, and its tiers (each an `ItemModifier` minus id/category/alignment, with the floor it starts on). `config.itemsPerGame` is the measured count of eligible items a game offers, so `perGame / itemsPerGame` is the chance per item and the config reads in the owner's own numbers. `ItemDefinition.family` pins one definition to a family (a cursed relic).
- **One roller, generic.** `rollItemFamily` rolls Normal first (one `rng()` for an eligible item, none otherwise), then a family by its share, then the deepest tier the floor has reached. Families below their `minFloor` give their share to Normal. Artifacts and non-equipment never roll.
- **Only loot rolls.** `createScaledItem` takes the config as an argument; floor loot, chests, vault chests, the boss hoard and monster drops pass it, while shop stock, starting gear, choice rewards and kill-rite essences don't, so they stay Normal. This also closes the shop's fixed-rng bug: `makeShopItem` rolls with `() => 0.5`, which would have made every piece of stock the same family.

## Alternatives Considered
- **Keep the templates in the engine and just wire the roller.** Rejected: campaign names and balance in engine source is the engine creep §3 forbids, and the next pack would need engine edits for its own families.
- **Open-string family ids.** Rejected for now: the eight tones, the merchant's polarity pricing and the temple's cleanse would need a per-family presentation and economy contract before an eighth family could exist. Alignment already carries the generic meaning; the ids can open later without changing saves (they are strings on disk).
- **A chance per item instead of counts per game.** Rejected: the owner decided in counts ("60 Positive / 45 Negative / 10 Chaotic"), the balance report measures counts, and a loot-volume change (tracker 2.4) is then one `itemsPerGame` re-measure rather than seven re-derived fractions.

## Consequences
- The pack's data lives in `src/content/cotw/itemFamilies.ts`; `tests/itemModifiers.test.ts` reads it rather than an engine table.
- Loot generation consumes one more `rng()` per eligible item, so floors generated from a given seed differ from before this change.
- Modifier ids are derived from the item's id (`<itemId>:<category>`), so a reroll from the same seed is the same modifier; the old module counter was not.
- Saves: no shipped save held a modifier; `ItemModifier.cursed` became `binds` in `SerializedItemModifier` with no migration.
- `itemsPerGame` is a measured number: re-measure it with `npm run balance` whenever loot volume changes.
