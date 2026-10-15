import type { EffectPrimitive } from './types';

/**
 * Pack-declared configuration for the optional magic systems: mana overflow, the
 * grimoire grid, kill rites and spell altars (`GameContentManifest.magic`).
 *
 * The engine owns the mechanisms and holds only neutral defaults; every table, label and
 * player-facing message comes from here (ARCHITECTURE.md §3, No Engine Creep and
 * Pack-Neutral Presentation). A pack that omits a section doesn't get that system: no
 * `overflow` keeps the hard mana wall, no `grimoire` casts every spell unmodified and
 * hides the grid, no `altars` places none.
 *
 * Message templates substitute `{caster}`, `{debt}`, `{damage}`, `{maxHp}`, `{monster}`,
 * `{spell}`, `{essence}`, `{glyph}`, `{slot}` and `{altar}` where the context has them.
 */
export interface MagicSystemConfig {
  overflow?: ManaOverflowConfig;
  grimoire?: GrimoireConfig;
  /** The three-grimoire model (P-29), which replaces `grimoire` once a pack declares it. */
  grimoires?: GrimoireSystemConfig;
  killRites?: KillRiteConfig;
  altars?: AltarDefinition[];
  /** Element pairs a forging altar fuses into a new spell (order-insensitive). */
  hybrids?: HybridRecipe[];
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

// ─── Grimoire grid ─────────────────────────────────────────────────────────

/** A declarative change to a spell as it is cast. */
export interface SpellModifier {
  manaCostDelta?: number;
  rangeDelta?: number;
  areaDelta?: number;
  /** Multiplies numeric damage and heal amounts (and basePower). */
  powerMultiplier?: number;
  /** Extra effect primitives appended to the spell's own. */
  addEffects?: EffectPrimitive[];
  /** After the cast, steps the caster up to this many cells directly away from the target. */
  retreatSteps?: number;
}

/** A permanent inscription on a grimoire slot, made at an inscribing altar. */
export interface GlyphDefinition {
  id: string;
  name: string;
  description: string;
  /** Offerings of these elements (essences or spells) yield this glyph. */
  fromElements?: string[];
  /** Spell offerings of these schools yield this glyph; checked before elements. */
  fromSchools?: string[];
  modifier: SpellModifier;
}

export interface GrimoireConfig {
  title: string;
  pageNames: string[];
  /** Slots (0-8, row-major) open at character creation; others open by grounding at an altar.
   * Omit to start with all nine open. */
  initialOpenSlots?: number[];
  centerSlotLabel?: string;
  /** Center slot: extra mana cost and extra power per occupied orthogonal neighbor. */
  centerCostPerNeighbor?: number;
  centerPowerPerNeighbor?: number;
  /** Power multiplier for a spell next to one of its opposing element (engine `ELEMENT_OPPOSITES`). */
  opposedElementPowerMultiplier?: number;
  maxGlyphsPerSlot?: number;
  glyphs?: GlyphDefinition[];
  /** Applied to a spell cast from a grounded slot whose element matches the slot's ground. */
  groundedModifier?: SpellModifier;
  /** Label for a locked slot, e.g. "Sealed". */
  lockedSlotLabel?: string;
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

/** A retired spell becomes another spell, or a base spell forged with an added element. */
export type RetiredSpellTarget = string | { spellId: string; addedElement: string };

export interface RetiredMagicConfig {
  /** Old spell id → what a hero who knew it knows instead; applied to known spells and the quick bar. */
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

// ─── Altars ────────────────────────────────────────────────────────────────

/**
 * - `inscribe`: burn an offering into a grimoire slot as a glyph.
 * - `forge`: fuse a known spell with an offering of another element into a hybrid.
 * - `ground`: burn an offering into a sealed slot, opening it with the offering's element.
 * - `gamble`: burn an offering for a random boon (or a price).
 */
export type AltarRite = 'inscribe' | 'forge' | 'ground' | 'gamble';

export interface AltarDefinition {
  /** Matches the altar tile's `interactionHandlerId`. */
  id: string;
  name: string;
  description: string;
  rite: AltarRite;
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
    glyphMessage: string;
    debtMessage: string;
  };
}

export interface HybridRecipe {
  elements: [string, string];
  spellId: string;
}

/** Fills `{key}` placeholders in a pack-provided message template. */
export function formatMagicMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
