# Companions & Pet Progression

> Topic doc under [content-extensibility.md](content-extensibility.md) ([ARCHITECTURE.md](../../ARCHITECTURE.md) §3). Explanatory only — every binding rule about content integration lives on the guaranteed-read path (`ARCHITECTURE.md`'s §3 stub and `content-extensibility.md`'s core sections), never only here. Flag a conflict rather than resolving it here (§8.2).

`Companion extends Monster` (`src/engine/entities/companion.ts`), with `faction: 'player'` so the existing generic `isHostileTo()` already treats it as an ally and hostile monsters as hostile to it — no changes to the hostility system. `manifest.companions` (`CompanionDefinition[]`) declares content-defined companions (stats, speed, pack-mule capacity), registered via `CompanionRegistry`. `GameEngine.summonCompanion()`/`dismissCompanion()` manage the single active companion (at most one at a time); it travels with the player across `changeFloor()` transitions, and persists as a top-level `SaveData.companion` field (schema v9) rather than as part of any one floor's monster list.

## Acquisition Gate
`summonCompanion()` refuses until `GameEngine.COMPANION_BONDED_FLAG` (`WorldState` flag) is set. `TrainerService.bondCompanion()` (a trainer-NPC-role `NpcRole`, e.g. town's "Ranvild the Hound-Warden") sets it for a one-time gold cost — a companion is quest/purchase-gated, not available from turn one.

## AI-Targeting Generalization
`selectAttackTarget(engine, actor)` (`ai/targetSelection.ts`) resolves a monster's attack/pathing target, defaulting to `engine.player` — behaviorally identical to the old hardcoded behavior — unless `Monster.targetingMode === 'nearest_hostile'` (`MonsterDefinition.targetingMode`, opt-in per monster, bounded-radius nearest-hostile search). No shipped monster's difficulty changes unless its content definition opts in; in `cotw`, `wolf`, `garmling`, and `brim_howler` do today. This is the prerequisite that lets a companion actually draw aggro and "tank."

## Archetypes
`Companion.archetype` (`'balanced' | 'bodyguard' | 'skirmisher'`) selects one of three `AIStrategy` implementations (`ai/aiRegistry.ts`): `companion_follow` (balanced, follow distance 2 — Phase 1's original behavior), `companion_bodyguard` (follow distance 1, stays tight to the player), `companion_skirmisher` (follow distance 5, proactively paths to a hostile within a 6-tile seek radius even before it's adjacent). `Companion.setArchetype()` switches both the archetype and its backing `aiRoutineId` together; `TrainerService.switchArchetype()` is the paid, trainer-gated entry point.

## Death & Revival
A dying companion is intercepted by `DeathResolver` (duck-typed via `companionDefinitionId`, not an `instanceof Companion` check, to avoid a value import into the `entities/monster.ts` circular-import cycle) before the generic `Monster` death pipeline (no XP or loot) and kept as `engine.deadCompanionRecord` (session-only, not persisted) rather than discarded. `TrainerService.reviveCompanion()` heals and reattaches the same instance — pack contents intact — for a gold cost. A living companion is explicitly excluded from the floor-monster-count that triggers floor-clear, since it is player-aligned, not a hostile the floor needs cleared of.

## Active Skills
`Companion.unlockedSkills: string[]`, taught via `TrainerService.teachSkill()` (paid, trainer-gated) and invoked via the `use_companion_skill` command. One is wired today: `rally_howl` heals the companion and hastes the player.

## Inventory Transfer
Items move both ways between the player and the companion's own `InventoryManager`/pack. `inventory-overlay.ts`'s `[G]` gives the selected backpack item (`transfer_to_companion`); `[K]` opens a companion-pack browser that lists what the companion carries, with `[↑↓]` to select, `[Enter]` to take (`transfer_from_companion`), and `[Esc]` to back out of the sub-view without closing the overlay. `EngineCommandBus.resolveItem` treats the active companion's pack as reachable, alongside carried, worn, and underfoot items — taking an item back is exactly that case.
