import type { CombatStats } from '../types';
import type { ElementType, ElementalAffinity } from '../magic/elements';
import type { StatusType } from '../status/types';
import type { Item } from '../items/item';

export type AiBehaviorType = string;
// Built-in behavior type constants
export const BUILTIN_AI_TYPES = {
  MELEE: 'melee',
  CASTER: 'caster',
  COWARD: 'coward',
  BRUTE: 'brute',
} as const;

export interface LootDropRule {
  chance: number; // 0.0 - 1.0 probability
  generate: (uniqueId: string) => Item;
}

export interface MonsterDefinition {
  id: string;
  name: string;
  minFloor?: number;
  stats: CombatStats;
  speed: number;
  aiType: AiBehaviorType;
  resistances?: Partial<Record<ElementType, ElementalAffinity>>;
  statusImmunities?: StatusType[];
  onHitAffliction?: {
    type: StatusType;
    chance: number;
    duration: number;
    potency?: number;
  };
  spells?: string[];
  spellCooldown?: number;
  fleeHealthPercent: number;
  xpValue: number;
  lootTable: LootDropRule[];
  hooks?: import('../hooks/hookDispatcher').HookDescriptor[];
  /**
   * Free-form creature tags (e.g. 'undead', 'aberration') resolved onto spawned
   * instances via `Entity.tags`/`hasTag()` (ARCHITECTURE.md P-25). `hasTag` already
   * also matches faction and entity type, so a tag only needs to name things that
   * aren't already implied by those.
   */
  tags?: string[];
  /**
   * Monster AI Targeting Generalization (ARCHITECTURE.md P-14 Phase 2). Default
   * (omitted, i.e. 'player') preserves this monster's exact current behavior —
   * always engaging `engine.player` — with zero change. Opt a monster into
   * 'nearest_hostile' only when you want it capable of engaging a companion.
   */
  targetingMode?: 'player' | 'nearest_hostile';
}

const monsterDefinitionsMap = new Map<string, MonsterDefinition>();

export class MonsterRegistry {
  public static register(def: MonsterDefinition): void {
    monsterDefinitionsMap.set(def.id, def);
  }

  public static registerAll(defs: MonsterDefinition[] | Record<string, MonsterDefinition>): void {
    const list = Array.isArray(defs) ? defs : Object.values(defs);
    for (const def of list) {
      monsterDefinitionsMap.set(def.id, def);
    }
  }

  public static get(id: string): MonsterDefinition | undefined {
    return monsterDefinitionsMap.get(id);
  }

  public static has(id: string): boolean {
    return monsterDefinitionsMap.has(id);
  }

  public static getAll(): MonsterDefinition[] {
    return Array.from(monsterDefinitionsMap.values());
  }

  public static clear(): void {
    monsterDefinitionsMap.clear();
  }
}

export function registerMonsterDefinition(def: MonsterDefinition): void {
  MonsterRegistry.register(def);
}

export function getMonsterDefinition(id: string): MonsterDefinition | undefined {
  return MonsterRegistry.get(id);
}

/**
 * @deprecated BESTIARY is content data and has moved to `src/content/cotw/monsters.ts`.
 * For runtime access to monster definitions, use `MonsterRegistry.get(id)` or `manifest.monsters`.
 */
export const BESTIARY: Record<string, MonsterDefinition> = new Proxy({} as Record<string, MonsterDefinition>, {
  get(_target, prop: string) {
    if (typeof prop === 'string') {
      return MonsterRegistry.get(prop);
    }
    return undefined;
  },
  has(_target, prop: string) {
    return typeof prop === 'string' && MonsterRegistry.has(prop);
  },
  ownKeys() {
    return MonsterRegistry.getAll().map((m) => m.id);
  },
  getOwnPropertyDescriptor(_target, prop: string) {
    const def = typeof prop === 'string' ? MonsterRegistry.get(prop) : undefined;
    if (def) {
      return { configurable: true, enumerable: true, value: def };
    }
    return undefined;
  },
});


