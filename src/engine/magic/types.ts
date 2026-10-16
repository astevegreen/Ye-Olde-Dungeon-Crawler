import type { ElementType } from './elements';

export type SpellSchool =
  | 'Combat'
  | 'Enchantment'
  | 'HealingDivination'
  | 'Movement'
  | 'Divination'
  | string;

export type TargetType =
  | 'self'
  | 'ray'
  | 'tile'
  | 'inventory_item';

export type TargetingMode =
  | 'self'
  | 'ray'
  | 'bounce_ray'
  | 'target_entity'
  | 'cone'
  | 'area_burst'
  | 'tile'
  | 'inventory_item';

/**
 * The tiles a shaped spell covers (P-33), each sized by `areaOfEffect` so the Area stat grows it:
 * - `cone`: from the caster toward the aim, `areaOfEffect` tiles long, stopped by walls;
 * - `nova`: every tile within `areaOfEffect` of the caster, the caster spared;
 * - `square`: `areaOfEffect` tiles a side on the aim, so even sizes work (4 is 4×4);
 * - `wall`: a line across the aim's direction through the aim, `areaOfEffect` tiles each side;
 * - `outAndBack`: flies `range` tiles through creatures and returns, striking each on the way out and back.
 */
export type SpellShape = 'cone' | 'nova' | 'square' | 'wall' | 'outAndBack';

export interface DamageEffect {
  type: 'damage';
  amount: string | number;
  element: ElementType | string;
  /** More elements the hit carries: it lands as the one the target resists least (`leastResistedElement`). */
  elements?: Array<ElementType | string>;
  /** A resisted hit lands as neutral; immunity and absorbing still hold. */
  pierce?: boolean;
}

export interface StatusEffectPrimitive {
  type: 'applyStatus';
  statusId: StatusType | string;
  duration: number;
  potency?: number;
}

export interface ChainEffect {
  type: 'chain';
  maxHops: number;
  hopRange: number;
  damageDecay: number; // e.g. 0.25 means 25% reduction per hop
}

export interface TeleportEffect {
  type: 'teleport';
  range: number;
  random: boolean;
  /** The caster lands on the tile aimed at, within `range` and in sight, instead of a random one. */
  aimed?: boolean;
}

/** Shoves each target `distance` tiles away from the caster (`applyImpulse`: wall stun, chasm fall, traps). */
export interface PushEffect {
  type: 'push';
  distance: number;
}

/** Drags each target up to `distance` tiles toward the caster, stopping beside it. */
export interface PullEffect {
  type: 'pull';
  distance: number;
}

/** The caster and the first target it can see trade places. */
export interface SwapEffect {
  type: 'swap';
  /** Also with a creature the caster senses through walls (a mark, a seer's reveal), not only one it sees. */
  sensed?: boolean;
}

export interface HealEffect {
  type: 'heal';
  amount: string | number;
  target?: 'caster' | 'target';
}

export interface RevealEffect {
  type: 'reveal';
  /**
   * What it shows. `actors`/`monsters`, `items`/`objects` and `map` reach the whole floor
   * unless `withinReach`; the rest are a seer's narrower layers, always within reach:
   * sleeping foes, hidden traps, secret doors, ground items named, foes' weaknesses (their
   * bestiary page), the floor's strongest foe (anywhere), and landmarks with the creatures
   * that are neither friend nor foe.
   */
  target:
    | 'actors'
    | 'items'
    | 'map'
    | 'monsters'
    | 'objects'
    | 'sleepers'
    | 'traps'
    | 'secretDoors'
    | 'itemNames'
    | 'weaknesses'
    | 'strongest'
    | 'landmarks';
  /** Turns what it senses stays sensed (30 unset). */
  duration?: number;
  /** Only within the spell's reach of the caster: its `areaOfEffect`, which the Area stat grows. */
  withinReach?: boolean;
}

export interface IdentifyEffect {
  type: 'identify';
}

/**
 * Lifts afflictions (`StatusHandler.affliction`) off each target, or off the caster with
 * `target: 'caster'`: the longest-lasting one, or with `all` every one.
 */
export interface CleanseEffect {
  type: 'cleanse';
  all?: boolean;
  target?: 'caster' | 'target';
}

/** Moves the caster's afflictions to its targets; one a target is immune to stays with the caster. */
export interface HandOverEffect {
  type: 'handOver';
}

/** Breaks the curses on everything the caster wears and carries (`breakCurses`). */
export interface UncurseEffect {
  type: 'uncurse';
}

/**
 * Spawn a monster adjacent to the caster.
 * `monsterId` must match a `MonsterDefinition.id` in the manifest.
 * `range`    — max spawn radius from caster (default 2).
 * `duration` — turns until the summoned entity despawns (0 = permanent).
 * `friendly` — if true the summoned entity's faction is set to 'player'.
 * `decoy`    — a friendly summon with a duration also carries the `decoy` status that long:
 *              monsters that perceive it go for it before the hero.
 * `bears`    — statuses a summon with a duration carries that long, ending before it leaves:
 *              a status with an ending (`StatusEnding`) makes it shatter or burst.
 */
export interface SummonEffect {
  type: 'summon';
  monsterId: string;
  range?: number;
  duration?: number;
  friendly?: boolean;
  decoy?: boolean;
  bears?: StatusType[];
}

/** Permanently teaches the (player) caster a spell, e.g. from a rune tablet read as a scroll. */
export interface LearnSpellEffect {
  type: 'learn_spell';
  spellId: string;
}

/**
 * Covers the cast's open tiles (`EffectContext.tiles`) with a ground surface or a gas of `kind`
 * for `duration` turns, replacing what lay there. Its behaviour is the surface table's (P-32); a
 * creature already on a tile feels it from the next turn, as standing in it.
 */
export interface LayEffect {
  type: 'lay';
  layer: 'surface' | 'gas';
  kind: string;
  duration: number;
  potency?: number;
}

/**
 * Raises a temporary wall on each walkable tile the spell covers (P-35, `surfaces/tempWalls.ts`):
 * `hp` and `turns` it stands for, the name the log gives it, and the surface it leaves as rubble.
 */
export interface RaiseWallEffect {
  type: 'raise_wall';
  hp: number;
  turns: number;
  name?: string;
  rubble?: { kind: string; turns: number };
}

export type EffectPrimitive =
  | LearnSpellEffect
  | LayEffect
  | RaiseWallEffect
  | DamageEffect
  | StatusEffectPrimitive
  | ChainEffect
  | TeleportEffect
  | PushEffect
  | PullEffect
  | SwapEffect
  | HealEffect
  | RevealEffect
  | IdentifyEffect
  | UncurseEffect
  | CleanseEffect
  | HandOverEffect
  | SummonEffect
  | { type: string; [key: string]: any };

import type { StatusType } from '../status/types';
import type { SpellVisualConfig } from '../types/effects';
import type { SpellType } from './magicConfig';
export type { SpellVisualConfig };

export interface SpellDefinition {
  id: string;
  name: string;
  school: SpellSchool;
  manaCost: number;
  /** Current HP paid per cast (blood magic); Thrift lowers it as it lowers mana (`effectiveHpCost`). */
  hpCost?: number;
  /** Execute gate: the target must be at or below this fraction of max HP. */
  maxTargetHpPercent?: number;
  element: ElementType;
  range: number;
  basePower: number;
  areaOfEffect: number; // 0 = single cell, 1 = 3x3 blast
  /** Tiles of `areaOfEffect` each Area step of its slot adds (1 unset): a seer's reach grows faster than a blast. */
  areaStep?: number;
  reflects: boolean; // True for lightning bolt bouncing off walls
  targetType: TargetType;
  description: string;
  targetingMode?: TargetingMode;
  /** The tiles it covers instead of a ray or burst (`SpellShape`). */
  shape?: SpellShape;
  /**
   * Turns its foes get to step out: the cast marks the tiles its shape or burst covers, and
   * it strikes them after the caster's next `delay` actions (`delayedBlast.ts`). Unset strikes at once.
   */
  delay?: number;
  /** What the spell does, in order, to what it reaches (`EffectPrimitiveRegistry`). */
  effects: EffectPrimitive[];
  /** Where effects borrowed from touching grimoire slots land (P-30); a spell without one borrows nothing, but still lends. */
  spellType?: SpellType;
  /** Flavour ids this spell lends instead of its element's (frith spells lend healing, blood spells Blood-price). */
  lends?: string[];
  /**
   * What this spell makes of a flavour a neighbour lends it, by flavour id, in place of the
   * flavour's own effects (`LendOverride`). A spell with no `spellType` borrows only these.
   */
  lendOverrides?: Record<string, LendOverride>;
  /**
   * Turns the hero spends channelling it: the cast pays and begins, and the spell goes off
   * when the channel ends; acting other than waiting, or being hurt, breaks it (`spellChannel.ts`).
   */
  channel?: number;
  visual?: SpellVisualConfig;
  statusAffliction?: {
    type: StatusType;
    duration: number;
    potency?: number;
  };
}

/** What one spell makes of one borrowed flavour (`SpellDefinition.lendOverrides`). */
export interface LendOverride {
  /** Effects in place of the flavour's own, delivered as the spell's type delivers (on the caster for a typeless spell); empty for none. */
  effects?: EffectPrimitive[];
  /** Reach the spell gains: added to its `areaOfEffect`. */
  reachBonus?: number;
  /** The spell's own aim and effects, changed (Odin's sight: a hop that lands where aimed). */
  spell?: Partial<Pick<SpellDefinition, 'targetType' | 'targetingMode' | 'range' | 'effects'>>;
}

export interface ProjectileStep {
  x: number;
  y: number;
  isReflection?: boolean;
}

export interface ProjectilePathResult {
  path: ProjectileStep[];
  impactTile: { x: number; y: number };
  hitWall: boolean;
  /** The solid cell it struck, when that cell is on the map (a temporary wall takes the hit there). */
  wallTile?: { x: number; y: number };
  hitEntityId?: string;
  reflectionsCount: number;
}
