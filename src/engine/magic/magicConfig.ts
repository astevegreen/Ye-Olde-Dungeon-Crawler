import type { EffectPrimitive } from './types';

/**
 * Pack-declared configuration for the optional magic systems: mana overflow, the
 * grimoire grid, kill rites ("Galdr" in cotw) and spell altars (`GameContentManifest.magic`).
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
  galdr?: KillRiteConfig;
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
