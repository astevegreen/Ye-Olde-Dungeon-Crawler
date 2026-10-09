# Item

An item is an `ItemDefinition` (`src/engine/types/manifest.ts`) in `COTW_ITEMS`. Models: `da2f185` (a catalog consumable), `1ee1db5` (a shop scroll naming a spell), `9a65634` (the torch), `0e2b628` (families as pack data), `4a6887f` (`wornEffects`).

## An item
1. **Pick the home.** Done when the id is unique, snake_case, and clashes with nothing under `src/engine/`, `src/ui/`, `src/rendering/` or `src/main.ts` (grep `'<id>'`): `ring`, `torch`, `gem`, `key`, `mace`, `bow`, `scroll`, `belt` and `purse` are sprite fallback keys there.
   - **Random loot:** the slot's file, `items/<slot>.ts`, feeding `COTW_CATALOG`; bump the counts in `itemCatalog.test.ts`.
   - **Sold, granted or a named drop only:** the `lootWeight: 0` block of `items/legacy.ts`, whatever its slot; a unique (a miniboss's ring) also sets `quality: 'artifact'`, or it rolls a family like any ring.
   - `NON_CATALOG_ITEMS` (`makeItem.ts`) holds only plain items with no hooks, `wornEffects` or potion effects: they lose their definition fields on load, and no monster may drop one.
2. **Fill the fields.** Required: `id`, `name`, `category`, `weight` (grams), `bulk` (cm³). cotw also always sets `unidentifiedName` (unique: unidentified items stack by it), `tier` (1–4 by depth), `minFloor`, `identified`, `description`, `value` (copper), and `slot` on anything worn.
   - `category` must be one its slot accepts (`slots.ts`): wrists take `bracers`, hands `gauntlets`, the off hand a `shield`, `weapon` or `light`.
   - A wand, scroll, potion or container sets `itemType` and its `*Config`; a scroll's or wand's `spellId` names a spell in `spells.ts`.
   - `quality` is only ever `'artifact'`, which never rolls a family. `twoHanded` blocks the off hand. `rangedConfig` does nothing in play: leave it out.
3. **Set how it is found.** An item is drawn once `minFloor` is reached and `lootWeight` > 0 (default 1; rare items 0.25–0.5; 0 never drops at random). Three in four draws come from the eight newest definitions by `minFloor`, so a new deep item crowds the others. Only weapons, armour, shields, helmets and boots roll +N, and only the categories listed in `itemFamilies.ts` roll a family.
   - **Shop:** `makeShopItem('<id>', '<merchant>-<short>-<n>', predicate?)` in the merchant's `initialInventory` (`town.ts`); stock is +0 with no family, priced at most three times the starting purse, never a starter-kit id.
   - **Drops and grants:** a monster's `itemDrop` (`MONSTER.md`), a choice's `grantItem`, the starter kit (`character.ts`).
4. **Give it its effect** from what exists. Passive: `wornEffects` with an `ItemModifier` field that a `*Worn` reader or `wearsFlag` (`wornModifiers.ts`) reads; grep the field's reader first. Some fields are read only from bestiary mastery perks (`coinMultiplier`, `xpMultiplier`, `sensesWithin`, through `compendium/familyPerks.ts`), and on gear they do nothing. Reactive: `hooks` (`onHit` is the wearer's own blows; `onDamageTaken`/`onBlock` is being struck). Potions: `potionConfig.effects`. Anything new is the effect branch below.
5. **Write the description** to say only what the data does; the inventory shows no line for `wornEffects`, so the text is the player's only word. `itemDescriptions.test.ts` holds the patterns: protection needs `wornEffects`, "when struck" needs an `onDamageTaken` or `onBlock` hook, other claims need one or the other. A radial flask says "friend or foe": it hits allies.

## A family tier, a family or an effect
- **A new tier or variant** (pack only): append to the family's `tiers` in `itemFamilies.ts`. The deepest tier reached wins, and tiers sharing a `minFloor` are random variants. `prefix` or `suffix` is the only name it gives an item; `description` shows in the item panel. The per-game budgets are pinned in `itemFamilies.test.ts` and `lootVolume.test.ts`.
- **A new family id** is engine data (`items/modifiers.ts`), saved with every rolled item and coloured by the UI. ADR-0012 rejected open family ids: this is the owner's decision.
- **A new passive effect** is a generic engine capability:
  1. Add the field to `ItemModifier` (`src/engine/items/modifiers.ts`) with a doc comment naming its one reader; perks and family tiers inherit it.
  2. Read it in one place, through `wornModifiers.ts` (`sumWorn`, `productWorn`, `lowestWorn`, `highestWorn`, `wearsFlag`), which already merges worn modifiers, `wornEffects` and perks; or a `Player` getter. A reader in `engine.ts` or `actionPipeline.ts` needs `§8.1 exception 5: <why>` in the commit.
  3. A family tier that carries it adds it to `SerializedItemModifier` (`storage/types.ts`), since family modifiers are saved whole; optional, so no schema bump.
  4. Test it in `tests/itemModifiers.test.ts`, `src/engine/items/__tests__/wornEffects.test.ts` or `src/engine/__tests__/perkEffects.test.ts`, and pin the cotw item on a real hero as `itemDescriptions.test.ts` does. Name the new capability in `content-extensibility.md`'s "Items and Item Families".
- **A new potion effect:** a `ConsumableEffectDescriptor` member and its case in `DrinkPotionAction` (`spell-actions.ts`). A new scroll or wand effect is a spell effect (`SPELL.md`).

## Finish
- **Tests:** catalog counts, description patterns and shop asserts as above, then a test of what the item does (`progression.test.ts` drinks the Mead).
- **Sprite:** a recipe keyed by the definition id in `COTW_ITEM_SPRITES` (`sprites/items.ts`: `(ctx, ox, oy)` on a 32-unit cell, colours from `COTW_ATLAS_THEME.palette`) draws it everywhere: map, inventory, shop, sidebar. Without one the renderer guesses from name and category (a wand draws as a potion). A new category needs a case in `sprite-mapper.ts`, which makes it a presentation change. An alias also joins `aliases` in `spriteRecipes.test.ts`.
- **On the hero:** a weapon, body armour or shield also shows on the hero's map sprite (`sprites/heroLook.ts`): the weapon's kind from keywords in its id and name (one they miss joins `WEAPON_BY_ID`), armour's band from its weight, a shield's size from weight or "tower". A new weapon joins the table in `heroSprite.test.ts`.
- **Creep:** ids in `manifest.items` are collected. The allowlist holds the engine's starter-kit ids and the sprite fallback keys; removing one of those items means deleting its entry.
- **Gates:** `npx vitest run src/content/cotw/__tests__` while iterating, then `npm run gate-stamp -- run lint test`. Any loot change shifts every seeded floor: run `npm run balance` before and after, quote both. `npm run validate:schema` when the save changes shape; `npm run gates` when presentation changed.
