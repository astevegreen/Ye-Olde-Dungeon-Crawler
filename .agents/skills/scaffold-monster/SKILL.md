---
name: scaffold-monster
description: Scaffold a new monster in the cotw content pack (src/content/cotw/), with its sprite, bestiary family, kill rite and seeded-PRNG loot, and engine access only through src/engine/index.ts. Use when asked to create or add a monster.
---

# Skill: Scaffold Monster

All work is in the cotw pack, `src/content/cotw/` (the WarCraft pack is parked, ADR-0010). Import the engine only through `src/engine/index.ts` (`import type { MonsterDefinition } from '../../../engine'`), never a deep path into engine internals. A monster needs no engine change; if it seems to, stop and ask (ARCHITECTURE.md §3 No Engine Creep, §8.1).

Read an existing monster first, e.g. `src/content/cotw/monsters/rimeHollows.ts`, and copy its shape.

1. **Pick the file.** `monsters/index.ts` re-exports every file and builds `COTW_MONSTERS`, which the manifest registers (`monsters: COTW_MONSTERS` in `index.ts`).
   - The seven zone files (`rimeHollows.ts` … `mawOfMalice.ts`) plus `bosses.ts` are the canonical 37-monster roster: five a zone, two bosses. `src/content/cotw/__tests__/monsterRoster.test.ts` pins every count and every name. Add to one of them only when the owner asks to change the roster, and update that test in the same commit (the zone's count, the 37 totals, the named-entry list).
   - A set-piece monster (a miniboss, a guard) goes in `minibosses.ts`; a prologue monster in `prologue.ts`. Neither file is count-pinned.
   - `legacy.ts` is the classic roster: the pack's first monster set (giant rats, kobolds, wolves, draugr, troll-wife warlocks), live content that leads `COTW_MONSTERS` and fills every wandering band in `quest.ts`. The name is historical. A classic foe the owner asks for goes here, appended at the end: the catalog's order is part of what a seed spawns, so existing entries keep their places.
2. **Spawning.**
   - `minFloor` is the floor it unlocks on and drives spawn weighting (`dungeonSpawnWeight` in `src/engine/dungeon/spawner.ts`): its draw weight is 1 on that floor, half six floors later, and about a tenth twelve floors later. Deeper floors also scale its stats, and from ten floors past it the monster is named a veteran.
   - Random floor population draws from the whole catalog. Wanderers draw from the depth band's `monsterIds` in `quest.ts` `floorEncounters` when one is eligible; list it there only if it should wander.
   - A set-piece monster sets `placedOnly: true`, so nothing draws it at random, and is placed by content: a vault's `minibossId` (`vaults.ts`), the lair's `bossFloorLayout.guards` (`quest.ts`), or the prologue. Name the placement in a comment beside the flag, as `minibosses.ts` does.
3. **Loot** (`lootTable`): each rule's `generate(id, rng, floor)` must use the `rng` it is passed (the engine's seeded PRNG), never `Math.random()` or `Date.now()`; `check:engine-purity` fails on both. Use the pack helpers:
   - `itemDrop(weight, itemId)` (`items/makeItem.ts`) for an ordinary item drop: scaled by the pack's drop volume, and never above the floor the item unlocks on.
   - `{ chance, generate: coinDrop(richness) }` (`coinage.ts`) for coin; 1 is an ordinary monster of its depth.
   - `makeLootItem(itemId, id, rng, floor)` for a guaranteed or fixed-floor drop (bosses, minibosses).
4. **Kill rite.** `killRite` is optional in the engine, but every cotw monster must carry one, except the night raid's (the monsters `COTW_PROLOGUE.monsters` places), which leave before any rite could be met and must have none. Add an entry keyed by the monster's id to `COTW_KILL_RITES` in `killRites.ts` (`monsters/index.ts` attaches it), with a `hintVerse`. `__tests__/killRites.test.ts` fails on a monster without one and on a rite for a raid monster, and checks the rite can be met within ten floors of `minFloor` (a rite that teaches a spell, on `minFloor` itself) and never asks for a status the monster is immune to.
5. **Bestiary family.** Add the id to exactly one family's `members` in `monsterCategories.ts`. `__tests__/monsterCategories.test.ts` fails on a monster with no family or two.
6. **Sprite.** A `spriteRecipes` entry keyed by the monster's id is its own sprite (ARCHITECTURE.md §3): add one to `COTW_MONSTER_SPRITES` in `sprites/monsters.ts`, drawn from the pack palette (`COTW_ATLAS_THEME.palette`), or alias an existing recipe by id in `sprites/index.ts` (as `nidhogg` does). Without one, it falls back to its `tags` (`atlas.spriteTagRules` in `atlas.ts`, then the renderer's generic archetypes), so tag it with an archetype that looks right. Never name the monster in `src/ui/` or `src/rendering/`.
7. **Verify:** `npm run lint` and `npm test` (the roster, family, kill-rite and sprite-recipe tests above all run in it), then `npm run sim`.
