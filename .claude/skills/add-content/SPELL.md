# Spell

A spell is a `SpellDefinition` (`src/engine/magic/types.ts`) composed from the engine's built-in effects; a pack cannot add an effect kind. Models: `1ee1db5` (a scroll-only spell), `56342bd` (the hybrids).

## Steps
1. **Pick the id.** The registry keeps the last of two equal ids without a word, so grep the pack for it. Grep `'<id>'` in `src/engine/`, `src/ui/`, `src/rendering/` and `src/main.ts` too: an id equal to an engine literal (`heal`, `haste`, `chain`) fails the creep gate, so pick another. Done when both greps come back empty.
2. **Define it** in `COTW_SPELLS` (`src/content/cotw/spells.ts`), above the spreads that close the array.
   - **Targeting:** cotw pairs `targetType` with `targetingMode` as `ray`/`ray`, `tile`/`area_burst` with `areaOfEffect: 1`, `ray`/`bounce_ray` with `reflects: true`, or `self`/`self`.
   - **`effects`:** compose `damage` {amount, element}, `applyStatus`, `heal`, `teleport`, `reveal`, `identify`, `uncurse`, `chain` (after a `damage`), `summon` (its `duration` sends the creature back) and `learn_spell`. Amounts are numbers: the HUD and the rite tests read only numbers. An empty list casts and does nothing.
   - A spell that inflicts a status also sets `statusAffliction`, so a monster doesn't recast it on a target already afflicted.
   - `visual` is optional (the element's colour by default); its archetypes are in `src/engine/types/effects.ts`.
   - **Numbers** come from neighbours: single-target bolts deal 2.3–2.7 damage per mana (`firebolt` 12/5, `cold_ray` 14/6); bounces and bursts cost more (`lightning_bolt` 16/9, `fireball` 18/12); heals 20/4 and 30/8; utility 4–14 mana. `basePower` is the first damage or heal amount, 0 for utility. Content never scales a spell by level: the Grimoire, Intelligence and gear do.
3. **Check the element** is in `COTW_AFFINITY_MATRIX` (`elements.ts`), and every effect's element too. `poison` has no essence and no rune.
4. **Make it learnable.** Every spell outside the schools `BloodMagic`, `Lore`, `Hybrid` and `Scroll` must be learnable from kill rites alone by floor 33 (`killRites.test.ts`).
   1. **Rite:** set `teachesSpellId` on a rite in `COTW_KILL_RITES` (`killRites.ts`) whose monster teaches nothing yet and isn't one of the night raid's. The rite must be meetable on that monster's `minFloor` with the spells learnable by then. Update the pacing comment at the file's top.
   2. **Tablet:** one row in `TABLETS` (`spellTablets.ts`): `spellId`, `spellName`, `soldFromFloor` (the first floor past the spell's zone), `value`. The row makes the `learn_<id>` spell, the tablet item and its place in the alchemist's stock.
   3. **Loki:** add the id to `LOKI_SPELL_POOL` (`magic.ts`).
   4. Other ways in, as the design wants: a choice's `learnSpell` consequence, a scroll's or wand's `spellId` (`items/legacy.ts`), a monster's `spells`.
   A spell nobody learns by rite (scroll-only) takes the school `Scroll`. The school also picks the Grimoire glyph (`fromSchools`, `magic.ts`).
5. **Hybrid branch** (forged at an altar from two elements): build it with `hybrid()` (`hybridSpells.ts`), append it to `COTW_HYBRID_SPELLS` and its `{ elements: [a, b], spellId }` to `COTW_HYBRID_RECIPES`.
   - Pairs are unordered and the first match wins, so check `COTW_HYBRID_RECIPES` for the pair first: a taken pair makes the new recipe dead.
   - Both elements must be reachable: some learnable spell's `element`, or an essence (`items/essences.ts`).
   - Wider, not bigger: damage about the stronger parent's, cost a few mana above it.
   - Runestone lore may tell of it (`fusionSpellId`); its text never promises to teach it, since fusions are only forged (`runestoneText.test.ts`).

## Finish
- **Tests:** the content suite already checks rite learnability and pacing, a tablet per rite-taught spell, recipe and Loki ids, elements in the matrix, overkill rites against each element's strongest damage, wand and scroll targets, and a rune per spell. A spell that does something no spell did before gets a test of that effect.
- **Sprite:** the belt rune is `spell~<id>` if a recipe has that key, else `spell~<element>` (`sprites/spellRunes.ts`); `spellRunes.test.ts` fails on a spell with neither, so a poison spell needs its own.
- **Creep:** every spell id is collected, `learn_*` and hybrids included. An underscored id is also caught inside compounds (`'spell~steam_lance'`). Rename on a clash rather than allowlisting; removing a spell that has an allowlist entry means deleting the entry, which fails as stale otherwise.
- **Gates:** `npx vitest run src/content/cotw/__tests__` while iterating, then `npm run gate-stamp -- run lint test` and `npm run sim` (it casts cotw spells).
