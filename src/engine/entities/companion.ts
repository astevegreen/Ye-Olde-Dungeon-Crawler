import type { Position, CombatStats } from '../types';
import { Monster } from './monster';
import { InventoryManager } from '../inventory/inventory-manager';
import { Container } from '../items/container';
import type { EngineRegistries } from '../registries';

/**
 * Companions & Pet Progression (docs/architecture/content-companions.md).
 *
 * Content-defined data for a summonable companion: stats/speed for combat and
 * movement, and a pack-mule capacity. AI archetype and unlocked skills are
 * per-instance state (`Companion.archetype`/`unlockedSkills`) set by a trainer
 * NPC (Phase 2), not part of the content definition.
 */
export interface CompanionDefinition {
  id: string;
  name: string;
  stats: CombatStats;
  speed: number;
  /** Pack-mule capacity for the companion's own inventory. */
  packWeightCapacity: number;
  packBulkCapacity: number;
}

/**
 * Trainer-taught AI archetype (docs/architecture/content-companions.md Phase 2). Each maps to its own
 * `AIStrategy` id in `ai/aiRegistry.ts`. 'balanced' is `companion_follow` (Phase 1's
 * original behavior); 'bodyguard' stays tight to the player (more likely to be the
 * nearest hostile target for any monster that has opted into `targetingMode:
 * 'nearest_hostile'`); 'skirmisher' roams further and engages hostiles proactively.
 */
export type CompanionArchetype = 'balanced' | 'bodyguard' | 'skirmisher';

const ARCHETYPE_AI_ROUTINE: Record<CompanionArchetype, string> = {
  balanced: 'companion_follow',
  bodyguard: 'companion_bodyguard',
  skirmisher: 'companion_skirmisher',
};

import { activeCompanionStore } from '../registries/companionRegistryStore';

/**
 * Process-wide facade over whichever companion store is active (ARCHITECTURE.md §3).
 * It holds no map of its own: an engine's registrations live in that engine's store, and
 * this forwards there, so there is one copy of the data rather than two.
 */
export class CompanionRegistry {
  public static register(def: CompanionDefinition): void {
    activeCompanionStore().register(def);
  }

  public static registerAll(defs: CompanionDefinition[] | Record<string, CompanionDefinition>): void {
    activeCompanionStore().registerAll(defs);
  }

  public static get(id: string): CompanionDefinition | undefined {
    return activeCompanionStore().get(id);
  }

  public static has(id: string): boolean {
    return activeCompanionStore().has(id);
  }

  public static getAll(): CompanionDefinition[] {
    return activeCompanionStore().getAll();
  }

  public static clear(): void {
    activeCompanionStore().clear();
  }
}

/**
 * A persistent, player-aligned follower. Extends `Monster` to reuse its combat,
 * movement, pathfinding, and scheduler machinery. `faction: 'player'` means the
 * pre-existing generic `Entity.isHostileTo()` already treats it as an ally and
 * hostile monsters as hostile to it — no changes needed to the hostility system.
 *
 * Whether a hostile monster can actually engage the companion instead of the
 * player depends on that monster's own `targetingMode` (docs/architecture/content-companions.md
 * Phase 2, `ai/targetSelection.ts`) — a companion cannot "tank" against a monster
 * that hasn't opted into `'nearest_hostile'` targeting.
 */
export class Companion extends Monster {
  public readonly companionDefinitionId: string;
  public archetype: CompanionArchetype = 'balanced';
  public unlockedSkills: string[] = [];

  constructor(config: {
    id: string;
    name: string;
    position: Position;
    stats: CombatStats;
    speed: number;
    companionDefinitionId: string;
    packWeightCapacity: number;
    packBulkCapacity: number;
    inventory?: InventoryManager;
  }) {
    super({
      id: config.id,
      name: config.name,
      position: config.position,
      stats: config.stats,
      speed: config.speed,
      definitionId: config.companionDefinitionId,
      aiType: 'melee',
      aiRoutineId: 'companion_follow',
      aiState: 'hunting', // never sleeping — a summoned companion is always alert
      faction: 'player',
      fleeHealthPercent: 0, // loyal: does not flee
      xpValue: 0,
      lootTable: [],
      inventory:
        config.inventory ??
        new InventoryManager({
          ownerId: config.id,
          primaryPack: new Container({
            id: `${config.id}-pack`,
            name: `${config.name}'s Pack`,
            category: 'container',
            slot: 'pack',
            containerType: 'pack',
            weight: 800,
            bulk: 1500,
            maxWeightCapacity: config.packWeightCapacity,
            maxBulkCapacity: config.packBulkCapacity,
            identified: true,
            ownerId: config.id,
          }),
        }),
    });
    this.companionDefinitionId = config.companionDefinitionId;
  }

  /** Switches AI archetype (docs/architecture/content-companions.md Phase 2), taught by a trainer NPC. */
  public setArchetype(archetype: CompanionArchetype): void {
    this.archetype = archetype;
    this.aiRoutineId = ARCHETYPE_AI_ROUTINE[archetype];
  }

  /** Unlocks an active companion skill if not already known. Returns false if already known. */
  public unlockSkill(skillId: string): boolean {
    if (this.unlockedSkills.includes(skillId)) return false;
    this.unlockedSkills.push(skillId);
    return true;
  }

  // Named distinctly from `Monster.createFromDefinition` (rather than overriding it)
  // since that static method's return type isn't nullable, and companion lookups
  // are (definition may not exist), so an override would be an incompatible signature.
  public static fromDefinition(
    definitionId: string,
    id: string,
    position: Position,
    registries?: EngineRegistries
  ): Companion | null {
    const def = registries ? registries.companions.get(definitionId) : CompanionRegistry.get(definitionId);
    if (!def) return null;
    return new Companion({
      id,
      name: def.name,
      position,
      stats: { ...def.stats },
      speed: def.speed,
      companionDefinitionId: def.id,
      packWeightCapacity: def.packWeightCapacity,
      packBulkCapacity: def.packBulkCapacity,
    });
  }
}
