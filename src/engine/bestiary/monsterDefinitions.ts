import type { CombatStats } from '../types';
import type { TelegraphPattern } from '../ai/intent';
import { activeMonsterStore } from '../registries/monsterRegistryStore';
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
  /** Receives the engine's seeded PRNG delegate; never use Math.random here (ARCHITECTURE.md §7.2). */
  generate: (uniqueId: string, rng: () => number) => Item;
}

/** One entry in a monster's ordered spell preference (ARCHITECTURE.md §3). */
export interface MonsterSpellPreference {
  spellId: string;
  /** Skip this choice when the target already carries the status (e.g. do not re-apply a slow). */
  skipIfTargetHasStatus?: string;
  /** Chance to take this choice when it is eligible, 0..1. Defaults to always. */
  chance?: number;
}

/** A content-declared wind-up ability the caster AI may telegraph (ARCHITECTURE.md §3). */
export interface MonsterTelegraphedAbility {
  /** Spell the monster must know for the ability to be available. */
  requiresSpellId: string;
  /** Display name shown in the telegraph. */
  name: string;
  /** Flavour line logged when the wind-up starts. `{monster}` is replaced with its name. */
  message: string;
  pattern: TelegraphPattern;
  range: number;
  radius: number;
  multiplier: number;
  element: string;
  spawnSurface?: string;
  /** Chance to telegraph when in range and off cooldown, 0..1. */
  chance: number;
  /** Turns of spell cooldown the ability costs. */
  cooldown: number;
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
  /**
   * Ordered spell preference for the caster AI. The first entry whose conditions hold is
   * cast; without it the AI falls back to the first known spell. Content decides what a
   * monster favours — the engine no longer names specific spells (ARCHITECTURE.md §3).
   */
  spellPreferences?: MonsterSpellPreference[];
  /**
   * A telegraphed, wind-up ability. Declaring it here keeps the name, flavour text, and
   * shape in the content pack instead of the engine's AI (§3, No Engine Creep).
   */
  telegraphedAbility?: MonsterTelegraphedAbility;
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

/**
 * Process-wide facade over whichever monster store is active (ARCHITECTURE.md §3, P-22).
 * It holds no map of its own: an engine's registrations live in that engine's store, and
 * this forwards there, so there is one copy of the data rather than two.
 */
export class MonsterRegistry {
  public static register(def: MonsterDefinition): void {
    activeMonsterStore().register(def);
  }

  public static registerAll(defs: MonsterDefinition[] | Record<string, MonsterDefinition>): void {
    activeMonsterStore().registerAll(defs);
  }

  public static get(id: string): MonsterDefinition | undefined {
    return activeMonsterStore().get(id);
  }

  public static has(id: string): boolean {
    return activeMonsterStore().has(id);
  }

  public static getAll(): MonsterDefinition[] {
    return activeMonsterStore().getAll();
  }

  public static clear(): void {
    activeMonsterStore().clear();
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


