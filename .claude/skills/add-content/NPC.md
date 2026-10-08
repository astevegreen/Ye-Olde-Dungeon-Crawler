# NPC or companion

Town NPCs are `TownNpcDefinition`s in `COTW_TOWN.npcs` (`town.ts`); companions are `CompanionDefinition`s in `COTW_COMPANIONS` (`companions.ts`), with their skills in `services.trainerSkills`. Models: `350e365` (a town NPC with a service), `2502f20` (Ivalda, an NPC with a choice, added by a hook), `0f1376e` (two companions; fixes `b40187d`, `48525f4`), `8021cb1` (trainer-skill effects as data).

## A town NPC
1. **Define it** in `COTW_TOWN.npcs`: `id` (`npc-<name>`), `name`, `role`, `position`, `greeting`; optional `dialogText`, `advice` (shown for a role with no service), `shopId` with `merchantConfig`. A new role is engine work.
2. **Place it** by `position`, on open ground of `TOWN_ROWS` reachable from the spawn, clear of the furnishings, the spawn, the stairs, the return point, Ivalda's spot and the night raid's monster tiles (a raid monster whose tile is taken is silently dropped). A shopkeeper stands inside a building in `TOWN_BUILDINGS`.
3. **Give it a service** by role:
   - **Merchant:** a `merchantConfig` whose `id` equals the NPC's `shopId`, and an `initialInventory` that returns fresh `makeShopItem` items on every call (a shared array leaked one hero's purchases into another's shop).
   - **Smith:** an entry in `services.smiths`; the smith must also be a merchant, since the forge sits on its shop.
   - **Monster lore:** `role: 'sage'` and `services.monsterLore`. **Trainer:** `role: 'trainer'`. **Pacts or rune refills:** point `pactKeeperNpcId` or `runeOfReturn.attunementNpcId` (`index.ts`) at it.
4. **A dialogue choice** can't hang on a town NPC (`TownNpcDefinition` has no `choiceId`): build it as `new NPC({ …, choiceId })` in an action hook, as `ironClans.ts` does for Ivalda, and follow `STORY.md`. Story-reactive lines go through `npc.setDialogue` in `narrative.ts`'s town hook, never a field write.
5. **Old saves keep their town:** a saved town is restored as saved, so a new `town.npcs` entry appears only for new heroes, while a merchant's shop re-registers on load without its keeper. Reaching existing heroes takes a patch hook that adds the NPC on the next turn, skipping an occupied cell (`townFurnishings.ts`, Ivalda's). Whether to reach them is the owner's call.

## A companion or a companion skill
1. **Define it** in `COTW_COMPANIONS`: `id`, `name`, `stats` {hp, maxHp, attack, defense}, `speed`, `packWeightCapacity`, `packBulkCapacity`, and `growthPerLevel` (optional in the type, required for cotw: companions grow with the hero's level). A shipped companion's id never changes: saves store it.
2. **Acquisition:** the trainer's bond sets `companion_bonded`, and summoning then brings the dismissed, else the dead, else `COTW_COMPANIONS[0]`; index 0 is the trainer's companion. Any other companion comes from a choice's `{ type: 'grantCompanion', companionId }`, which dismisses the current one. Growth and revival need no data.
3. **A skill:** `{ id, name, description, effect }` in `services.trainerSkills` (`town.ts`). `effect` is the one `CompanionSkillEffect` shape: optional `companionHealPercent`, optional `heroStatus` {type, duration} naming a registered status, and a `message` with `{companion}` and `{healed}` placeholders. A richer effect is engine work. The trainer offers at most four skills; the wheel shows the first three learned.
4. Barks keyed by the companion's id go in `narrative.ts`'s barks hook.

## Finish
- **Tests:** existing tests check every NPC stands on reachable ground and shopkeepers inside their buildings, the town's NPC count and exactly three merchants (a new merchant updates `town-persistence.test.ts`), stock prices and starter-kit ids, and every companion's `growthPerLevel`. `packNeutralSource.test.ts` bans each capitalised word of an NPC's name from engine and presentation source, and trainer-skill ids and names as substrings of `src/ui/` and `src/rendering/`, so pick distinctive ones (not `heal`, `guard`). Add a test of the new thing: placement, the choice wiring, the grant or the skill's effect.
- **Sprite:** an NPC draws from a recipe keyed by its id in `COTW_SPRITE_RECIPES` (`sprites/index.ts`, as `npc-ivalda`), else from its role. A companion draws from a recipe keyed by its definition id; it has no tags, and the name fallback draws anything not a wolf or hound as a kobold, so a new kind needs its own recipe. An alias also joins `aliases` in `spriteRecipes.test.ts`.
- **Creep:** town NPC ids and names, companion ids and trainer-skill ids are collected; companion and skill names and hook-built NPCs are not. An id like `wolf` clashes with a sprite key: rename it rather than allowlisting.
- **Gates:** `npx vitest run src/content/cotw/__tests__` while iterating, then `npm run gate-stamp -- run lint test`; `npm run balance` when shop stock or prices change.
