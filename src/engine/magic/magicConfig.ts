import type { EffectPrimitive } from './types';

/**
 * Pack-declared configuration for the optional magic systems: mana overflow, the
 * three grimoires, kill rites and spell altars (`GameContentManifest.magic`).
 *
 * The engine owns the mechanisms and holds only neutral defaults; every table, label and
 * player-facing message comes from here (ARCHITECTURE.md §3, No Engine Creep and
 * Pack-Neutral Presentation). A pack that omits a section doesn't get that system: no
 * `overflow` keeps the hard mana wall, no `grimoires` casts every spell unmodified and
 * hides the grimoires, no `altars` places none.
 *
 * Message templates substitute `{caster}`, `{debt}`, `{damage}`, `{maxHp}`, `{monster}`,
 * `{spell}`, `{essence}`, `{altar}` and `{stone}` where the context has them.
 */
export interface MagicSystemConfig {
  overflow?: ManaOverflowConfig;
  /** The three-grimoire model (P-29). */
  grimoires?: GrimoireSystemConfig;
  killRites?: KillRiteConfig;
  altars?: AltarDefinition[];
  /** Spells learned at stones from a carrier's shard (P-34); with it, kill rites teach only as its shortcut. */
  learningStones?: LearningStoneConfig;
}

// ─── Mana overflow ─────────────────────────────────────────────────────────

/** One weighted result a surge can roll within its tier. */
export type OverflowOutcome =
  | {
      kind: 'spill';
      weight: number;
      /** One is picked at random and pooled on a passable cell next to the caster. */
      spills: Array<{ surface?: string; gas?: string; duration: number; potency: number; message: string }>;
      blockedMessage: string;
    }
  | { kind: 'backlash'; weight: number; deficitMultiplier: number; minDamage: number; message: string; flashColor?: string }
  | { kind: 'status'; weight: number; statusId: string; duration: number; message: string }
  | { kind: 'surface_under_caster'; weight: number; surface: string; duration: number; potency: number; message: string }
  | {
      kind: 'max_hp_burn';
      weight: number;
      amount: number;
      /** Max HP never burns below this; at the floor the caster takes `fallbackDamage` instead. */
      minMaxHp: number;
      fallbackDamage: number;
      message: string;
      fallbackMessage: string;
      flashColor?: string;
    }
  | { kind: 'displace'; weight: number; radius: number; message: string; blockedMessage: string }
  | { kind: 'message'; weight: number; message: string };

export interface OverflowTier {
  /** Total debt at which this tier starts; tiers are listed ascending. */
  minDebt: number;
  /** Short badge text, e.g. "Tier 2 Tremor". */
  label: string;
  color: string;
  burstRadius: number;
  burstDurationMs: number;
  outcomes: OverflowOutcome[];
}

export interface ManaOverflowConfig {
  /** Name of the debt resource in the UI, e.g. "Void Debt". */
  debtName: string;
  tiers: OverflowTier[];
  /** Outside town, rest never lowers debt that has reached this below it. Omit for none. */
  lingeringDebt?: number;
  /** Logged when a full rest leaves lingering debt behind. */
  lingeringRestMessage?: string;
}

// ─── Grimoires (P-29) ──────────────────────────────────────────────────────

/**
 * A grimoire slot's place: grid steps from its grimoire's centre (0, 0), `y` growing
 * downwards. A slot `k` steps out along an axis takes `k` steps of that axis's stat.
 */
export interface GrimoireCell {
  x: number;
  y: number;
}

/** `x` runs left and right of the centre, `y` above and below it. */
export type GrimoireAxis = 'x' | 'y';

/**
 * One grimoire: cells cut from a 3×3 grid around a centre. Cells touch by straight sides
 * only, so a slot has at most four neighbours.
 */
export interface GrimoireLayout {
  id: string;
  name: string;
  /** The base slots; (0, 0) must be among them, and every cell touches another. */
  cells: GrimoireCell[];
  /** Opens once the hero knows this many spells; omit to have it open from the start. */
  opensAtSpellsKnown?: number;
  /** The stat a picker suggests for each axis, by `GrimoireStatDefinition.id`. */
  suggestedStats?: Partial<Record<GrimoireAxis, string>>;
  /** One line shown when it opens. */
  openedMessage?: string;
}

/**
 * What one step of a stat does, by kind (the engine's six; the pack names and sizes them):
 * - `power`: damage and heal amounts × (1 + `perStep` × steps);
 * - `thrift`: cost, Seiðr or HP, × (1 − `perStep`) per step;
 * - `range`: + `perStep` tiles per step, on spells that have a range;
 * - `area`: + `perStep` radius per step, at most `maxStepsOnDamage` steps on a damage spell;
 * - `duration`: statuses, summons and terrain last × (1 + `perStep` × steps);
 * - `swift`: a cast takes `castTimeByStep[steps − 1]` of a turn, the last entry past its end.
 */
export type GrimoireStatKind = 'power' | 'thrift' | 'range' | 'area' | 'duration' | 'swift';

export interface GrimoireStatDefinition {
  id: string;
  name: string;
  description: string;
  kind: GrimoireStatKind;
  /** Size of one step; unused by `swift`. */
  perStep?: number;
  /** `swift` only: the share of a turn a cast takes after 1, 2, 3… steps. */
  castTimeByStep?: number[];
  /** `area` only: the most steps a spell that deals damage takes. Omit for no cap. */
  maxStepsOnDamage?: number;
}

export interface GrimoireSystemConfig {
  /** In opening order: a learned spell goes to the first free slot of the first open one. */
  layouts: GrimoireLayout[];
  stats: GrimoireStatDefinition[];
  /** How saves from before the switch, or holding spells since retired, carry over on load. */
  retired?: RetiredMagicConfig;
  /** What touching slots lend each other (P-30); omit and slots lend nothing. */
  lending?: NeighbourLendingConfig;
  /** How a forged spell is named. */
  forging?: ForgeConfig;
}

/** The forge (`forge` altars): a known spell gains a second element. */
export interface ForgeConfig {
  /**
   * The word a pair of elements gives a forged spell's title ("Cold Ray, steam-forged"),
   * keyed by the two element ids in alphabetical order joined by `+` (`cold+fire`). A pair
   * left out names the added element ("poison-forged").
   */
  titles?: Record<string, string>;
}

// ─── Neighbour lending (P-30) ──────────────────────────────────────────────

/**
 * The engine's six spell types (`SpellDefinition.spellType`). A type decides where a
 * borrowed effect lands, never what it is:
 * - `damage`: the spell's hit carries it;
 * - `control`: it lands on the held target;
 * - `heal`: it bursts on the foes beside the caster;
 * - `summon`: the summon's hits carry it;
 * - `movement`: it bursts on the tile the caster leaves;
 * - `terrain`: it becomes the ground's material, one borrowed flavour picked at random per cast.
 */
export type SpellType = 'damage' | 'control' | 'heal' | 'summon' | 'movement' | 'terrain';

/** One strength of a flavour: ordinary effects, plus what it does to the borrowing spell itself. */
export interface LendFlavourForm {
  name: string;
  /** Effects the borrowing spell delivers, by its type, beside its own. */
  effects: EffectPrimitive[];
  /** A colour for presentation (the doubled form's new colour). */
  color?: string;
  /** Power the borrowing spell's own effect gains, as a share (Blood-price 0.25). */
  powerBonus?: number;
  /** Current HP each cast of the borrowing spell costs (Blood-price 2). */
  hpCostPerCast?: number;
}

/** What a spell lends its neighbours, keyed by element (or `<element>:<school>`, see `lendBySchool`). */
export interface LendFlavour extends LendFlavourForm {
  id: string;
  /** The doubled form: lent to a spell of the flavour's own element, or from a doubled slot. Omit and both get the plain form. */
  doubled?: LendFlavourForm;
}

export interface NeighbourLendingConfig {
  flavours: LendFlavour[];
  /** Elements whose spells lend by school: such a spell lends the flavour `<element>:<school>`; a forged one lends `<element>`. */
  lendBySchool?: string[];
  /** Power a spell's own effect gains, as a share, beside one of its elements' opposites (or forged with one), once per cast. */
  oppositeBonus?: number;
}

/** A retired spell becomes another spell, a base spell forged with an added element, or nothing (`null`). */
export type RetiredSpellTarget = string | { spellId: string; addedElement: string } | null;

export interface RetiredMagicConfig {
  /** Old spell id → what a hero who knew it knows instead, or `null` to let it go; applied to known spells and the quick bar. */
  spells?: Record<string, RetiredSpellTarget>;
  /** Old glyph id → the item refunded for each such glyph inscribed on an old page. */
  glyphRunes?: Record<string, string>;
  /** Status ids dropped from a loaded hero. */
  statuses?: string[];
}

// ─── Kill rites ────────────────────────────────────────────────────────────

export interface KillRiteConfig {
  /** Bestiary section title. */
  title: string;
  prophecyLabel: string;
  reapedLabel: string;
  /** Logged when a rite teaches its spell. */
  learnMessage: string;
  /** Logged when a rite yields an essence (its spell is known, or it teaches none). */
  essenceMessage: string;
  /** Essence item id per element: what a rite yields when it teaches no new spell. */
  essenceItems: Record<string, string>;
  /** Chance (0–1) that a rite yielding an essence drops one; absent means always. */
  essenceDropChance?: number;
  /** Per-element overrides of `essenceDropChance`. */
  essenceDropChanceByElement?: Record<string, number>;
  /** Before a rite is performed, one plain-language condition is revealed per this many kills. */
  killsPerRevealedCondition?: number;
}

// ─── Learning stones ───────────────────────────────────────────────────────

/** A band of floors whose stones first show its spells, and whose carriers come from its kinds. */
export interface LearningStoneZone {
  minFloor: number;
  maxFloor: number;
  /** Spells first found on this zone's stones; a later zone's lend a face when these run out. */
  spellIds: string[];
  /** Monster kinds a stone's carrier is picked from, among those on its floor. */
  carrierIds: string[];
}

export interface LearningStoneDefinition {
  floor: number;
  /** The stone's tile; absent, the config's `tileId`. */
  tileId?: string;
  /** Faces shown instead of a draw (a fixed first stone), each while the hero doesn't know it. */
  faces?: string[];
  /** The carrier's kind, before the zone's list; spawned away from the arrival when the floor has none. */
  carrierId?: string;
}

export interface LearningStoneConfig {
  /** The stone tile placed where a stone's definition names none. */
  tileId: string;
  /** The item a carrier holds; it drops however the carrier dies. */
  shardItemId: string;
  stones: LearningStoneDefinition[];
  zones: LearningStoneZone[];
  /** What a spell read through a kill rite's shortcut costs, as a share of its price; absent, 0.9. */
  shortcutCostMultiplier?: number;
  /** The Spells page's spells no stone shows, each group with where it comes from; listed before the stones'. */
  elsewhere?: Array<{ spellIds: string[]; where: string }>;
  messages: {
    /** The Spells page's word on a spell another spell teaches (a tablet's): where that is had. */
    tablets?: string;
    /** On first arriving on a stone's floor: `{stone}`, `{monster}` (the carrier). */
    arrival: string;
    /** Stepping on the stone without its shard: `{stone}`, `{monster}`. */
    stoneFound: string;
    /** Picking the shard up marks the stone: `{stone}`. */
    shardMarks: string;
    /** A carrier killed by its kind's rite: `{monster}`, `{stone}`. */
    shortcut: string;
    /** A spell read from the stone: `{spell}`, `{stone}`. */
    learned: string;
    /** A shard turned into an Essence-Rune, at the stone or on leaving the floor: `{essence}`. */
    rune: string;
  };
}

// ─── Altars ────────────────────────────────────────────────────────────────

/**
 * - `double`: burn an offering to double what one grimoire slot lends its neighbours.
 * - `forge`: a known spell gains the offering's element beside its own; a re-forge swaps it.
 * - `restat`: choose afresh the stats of one grimoire's axes.
 * - `addSlot`: add a slot to a grimoire, beside one it has.
 * - `gamble`: burn an offering for a random boon (or a price).
 */
export type AltarRite = 'double' | 'forge' | 'restat' | 'addSlot' | 'gamble';

/** A rite an altar grants from some floor down, in place of its own. */
export interface AltarDeeperRite {
  fromFloor: number;
  rite: AltarRite;
  description: string;
  performedMessage: string;
}

export interface AltarDefinition {
  /** Matches the altar tile's `interactionHandlerId`. */
  id: string;
  name: string;
  description: string;
  rite: AltarRite;
  /** Deeper altars of this kind grant another rite: the last entry whose floor is reached wins. */
  deeperRites?: AltarDeeperRite[];
  /** The rite takes no offering. */
  free?: boolean;
  /** Performing any rite here also clears the hero's Void Debt. */
  clearsVoidDebt?: boolean;
  /** Logged when the rite is performed. */
  performedMessage: string;
  /** Logged on stepping onto an altar whose rite is spent. */
  spentMessage: string;
  /** `gamble` only: spells it may teach, and its three outcome messages. */
  gamble?: {
    /** Shown in the altar's preview before the rite, e.g. "Fate decides: ...". */
    previewText?: string;
    spellPool: string[];
    debtPenalty: number;
    spellMessage: string;
    /** Logged when it doubles what a slot lends; `{spell}` is the slot's spell. */
    doubleMessage: string;
    debtMessage: string;
  };
}

/** Fills `{key}` placeholders in a pack-provided message template. */
export function formatMagicMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
