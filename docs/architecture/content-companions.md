# Companions & Pet Progression

> How the companion system fits the engine; [`ARCHITECTURE.md`](../../ARCHITECTURE.md) §3 holds the rules, and [content-extensibility.md](content-extensibility.md) the pack wiring in general. Flag a conflict rather than resolving it here (§8.2).

`Companion extends Monster` (`src/engine/entities/companion.ts`) with `faction: 'player'`, so the generic `isHostileTo()` already treats it as an ally and hostile monsters as hostile to it. `manifest.companions` (`CompanionDefinition[]`) declares them, registered via `CompanionRegistry`. `GameEngine.summonCompanion()`/`dismissCompanion()` manage the single active companion; it travels with the hero across `changeFloor()` and is saved as the top-level `SaveData.companion`, not in any floor's monster list. It never sleeps and is scheduled like any active-floor actor (§6). Walking into it trades places (`actions/movement.ts`), so it never walls the hero in.

## Acquisition Gate
`summonCompanion()` refuses until `GameEngine.COMPANION_BONDED_FLAG` is set, and only a choice's `grantCompanion` consequence sets it: a companion is earned through the story, never bought, and not there from turn one. Summoning then brings back the hero's own, the dismissed or the fallen one, never a fresh one.

## Growth With the Hero's Level
A definition's `growthPerLevel` (`{ hp?, attack?, defense? }`) adds that much per hero level past the first. `growCompanion` (`combat/lastStand.ts`) recomputes the stats from the definition whenever they could change (a level, a summon or revival, a load, the companion's own turn) and adds the HP a change adds to what it has, so a wound stays a wound; nothing new is saved. Without `growthPerLevel` the stats stay as declared.

## AI-Targeting Generalization
`selectAttackTarget(engine, actor)` (`ai/targetSelection.ts`) resolves a monster's target: the hero by default, or the nearest hostile within a bounded radius when its definition sets `targetingMode: 'nearest_hostile'`. A monster's difficulty changes only if its definition opts in; this is what lets a companion draw aggro and tank.

## Archetypes
`Companion.archetype` (`'balanced' | 'bodyguard' | 'skirmisher'`) selects one of three `AIStrategy`s (`ai/aiRegistry.ts`): `companion_follow` (follow distance 2), `companion_bodyguard` (1) and `companion_skirmisher` (5, seeking a hostile within 6 before it is adjacent). `Companion.setArchetype()` switches the archetype and its `aiRoutineId` together. Nothing in play switches it (the trainer's retraining was cut, owner 2026-10-10): a new companion is `balanced`, and the other two load only from saves that hold them.

## Death & Revival
`DeathResolver` intercepts a dying companion before the generic monster death (no XP, no loot), recognizing it by `companionDefinitionId` rather than `instanceof Companion`, which would put a value import into the `entities/monster.ts` import cycle. It is kept as `engine.deadCompanionRecord` (saved as `SaveData.deadCompanion`); while it is set, `summonCompanion()` refuses and points to a trainer, so a fallen companion can't be replaced for free. `TrainerService.reviveCompanion()` restores the same instance, pack intact, for a price. A dismissed companion is kept too (`SaveData.dismissedCompanion`), and summoning brings back that instance. A living companion doesn't count toward clearing a floor.

## Active Skills and the Pack
`Companion.unlockedSkills` are taught by `TrainerService.teachSkill()` and used through the `use_companion_skill` command. The skills are pack data (`TownServicesDefinition.trainerSkills`: id, name, description and a `CompanionSkillEffect`), so the engine names none, and `check:engine-creep` collects their ids. Items move both ways between the hero and the companion's own `InventoryManager` (`transfer_to_companion`, `transfer_from_companion`); `EngineCommandBus.resolveItem` treats the companion's pack as reachable. The companion wheel (the radial menu) is input: [simulation-and-input.md](simulation-and-input.md).
