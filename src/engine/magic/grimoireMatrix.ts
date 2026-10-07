import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';
import type { SpellDefinition } from './types';
import { getSpell } from './spellRegistry';
import { ELEMENT_OPPOSITES, type ElementType } from './elements';
import type { GlyphDefinition, GrimoireConfig, SpellModifier } from './magicConfig';
import { StatusHandlerRegistry } from '../status/statusHandlers';
import { sumWorn } from '../items/wornModifiers';
import { effectiveManaCost } from './castNumbers';
import type { StatusHandler, StatusTickOutput } from '../status/statusHandlers';
import type { StatusEffect } from '../status/types';

/** A glyph inscribed on a slot at an altar: a pack `GlyphDefinition` at some potency. */
export interface InfusedGlyph {
  glyphId: string;
  potency: number;
  /** Name of the offering burned to make it. */
  sourceName: string;
}

export interface GrimoireSlot {
  slotIndex: number; // 0 to 8 (3x3 grid)
  spellId: string | null;
  infusedGlyphs?: InfusedGlyph[];
}

export interface GrimoirePage {
  id: string;
  name: string;
  slots: GrimoireSlot[];
}

export const GRIMOIRE_SIZE = 9;
export const CENTER_SLOT_INDEX = 4; // row 1, col 1
/** Neutral stored page names; a pack's `grimoire.pageNames` replace them for display. */
export const DEFAULT_GRIMOIRE_PAGE_NAMES = ['Page I', 'Page II', 'Page III'] as const;
const DEFAULT_OPPOSED_ELEMENT_POWER = 1.25;

/** The pack's grimoire config; without one the grid is off and spells cast unmodified. */
export function getGrimoireConfig(engine: GameEngine): GrimoireConfig | undefined {
  return engine.manifest?.magic?.grimoire;
}

/** A page's display name: the pack's name for that index, else the stored one. */
export function getGrimoirePageName(engine: GameEngine, player: Player, pageIndex: number): string {
  return (
    getGrimoireConfig(engine)?.pageNames[pageIndex] ?? player.grimoirePages[pageIndex]?.name ?? `Page ${pageIndex + 1}`
  );
}

export const GRIMOIRE_ATTUNE_STATUS = 'grimoire_attunement';

/** A slot's spell as it will actually be cast. */
export interface EffectiveSpell {
  spell: SpellDefinition;
  /** One plain note per synergy that changed the spell. */
  notes: string[];
  /** Cells the caster steps away from the target after the cast. */
  retreatSteps: number;
}

function lookupSpell(engine: GameEngine, spellId: string): SpellDefinition | undefined {
  return engine.manifest?.spells?.find((s) => s.id === spellId) ?? getSpell(spellId);
}

/**
 * Applies a declarative modifier `potency` times over (deltas multiply, a power multiplier
 * compounds). Extra effects only join spells that deal damage, so a glyph's slow or chain
 * never lands on the caster of a self spell. Returns the steps to retreat after casting.
 */
function applySpellModifier(spell: SpellDefinition, modifier: SpellModifier, potency = 1): number {
  if (modifier.manaCostDelta) spell.manaCost = Math.max(0, spell.manaCost + modifier.manaCostDelta * potency);
  if (modifier.rangeDelta && spell.range > 0) spell.range += modifier.rangeDelta * potency;
  if (modifier.areaDelta && spell.targetingMode !== 'self') {
    spell.areaOfEffect = (spell.areaOfEffect ?? 0) + modifier.areaDelta * potency;
  }
  if (modifier.powerMultiplier) scaleSpellPower(spell, Math.pow(modifier.powerMultiplier, potency));
  if (modifier.addEffects?.length && spell.effects?.some((e) => e.type === 'damage')) {
    spell.effects = [...spell.effects, ...modifier.addEffects];
  }
  return (modifier.retreatSteps ?? 0) * potency;
}

/** The glyph an offering of this element (and, for a spell, school) inscribes, if any. */
export function glyphForOffering(
  config: GrimoireConfig | undefined,
  element: string,
  school?: string
): GlyphDefinition | undefined {
  const glyphs = config?.glyphs ?? [];
  return (
    (school ? glyphs.find((g) => g.fromSchools?.includes(school)) : undefined) ??
    glyphs.find((g) => g.fromElements?.includes(element))
  );
}

/** The spell with the range what the caster wears and holds adds (`spellRangeBonus`, Odin's Eye); a spell with no range keeps none. */
export function withSpellRangeBonus(caster: Entity, spell: SpellDefinition): SpellDefinition {
  const bonus = sumWorn(caster, 'spellRangeBonus');
  return bonus !== 0 && spell.range > 0 ? { ...spell, range: spell.range + bonus } : spell;
}

/** Multiplies a spell's power: basePower and every numeric damage or heal amount. */
function scaleSpellPower(spell: SpellDefinition, mult: number): void {
  spell.basePower = Math.round((spell.basePower ?? 0) * mult);
  spell.effects = spell.effects?.map((e) =>
    (e.type === 'damage' || e.type === 'heal') && typeof e.amount === 'number'
      ? { ...e, amount: Math.round(e.amount * mult) }
      : e
  );
}

export class GrimoireMatrixManager {
  /**
   * Initializes a default 9-slot grimoire, placing initial known spells into slots.
   */
  public static createDefaultGrimoire(spellsKnown: string[] = [], openSlots?: number[]): GrimoireSlot[] {
    const slots: GrimoireSlot[] = [];
    for (let i = 0; i < GRIMOIRE_SIZE; i++) {
      slots.push({ slotIndex: i, spellId: null });
    }
    // Fill open slots in order; sealed ones stay empty
    const fillable = slots.filter((s) => !openSlots || openSlots.includes(s.slotIndex));
    spellsKnown.slice(0, fillable.length).forEach((spellId, i) => {
      fillable[i].spellId = spellId;
    });
    return slots;
  }

  /**
   * Initializes a default set of swappable grimoire pages.
   * Page 0 holds initial known spells; subsequent pages start blank for deckbuilding.
   */
  public static createDefaultGrimoirePages(spellsKnown: string[] = [], openSlots?: number[]): GrimoirePage[] {
    return DEFAULT_GRIMOIRE_PAGE_NAMES.map((name, index) => ({
      id: `page_${index + 1}`,
      name,
      slots: this.createDefaultGrimoire(index === 0 ? spellsKnown : [], openSlots),
    }));
  }

  /**
   * Returns orthogonal neighbor slot indices for a given slot index (0..8).
   */
  public static getOrthogonalNeighbors(slotIndex: number): number[] {
    const row = Math.floor(slotIndex / 3);
    const col = slotIndex % 3;
    const neighbors: number[] = [];

    if (row > 0) neighbors.push(slotIndex - 3); // Up
    if (row < 2) neighbors.push(slotIndex + 3); // Down
    if (col > 0) neighbors.push(slotIndex - 1); // Left
    if (col < 2) neighbors.push(slotIndex + 1); // Right

    return neighbors;
  }

  /**
   * The active-page slot a cast of `spellId` draws its synergies from: `preferred` when it
   * holds that spell, else the first slot that does, else undefined (the spell is known but
   * not slotted, so it casts unmodified).
   */
  public static findSlotForSpell(player: Player, spellId: string, preferred?: number): number | undefined {
    const slots = player.grimoire;
    if (preferred !== undefined && slots[preferred]?.spellId === spellId) return preferred;
    const index = slots.findIndex((s) => s.spellId === spellId);
    return index >= 0 ? index : undefined;
  }

  /**
   * Pairs of orthogonal open slots on the active page whose spells shape each other, by the
   * rules `resolveEffectiveSpellDetailed` applies: the center slot drawing on a filled
   * neighbor, opposed elements side by side, a ray beside a burst. For the Spellbook's
   * lines between slots; `a` is always the lower index.
   */
  public static slotInteractions(engine: GameEngine, player: Player): Array<{ a: number; b: number; reasons: string[] }> {
    const config = getGrimoireConfig(engine);
    if (!config) return [];
    const spellAt = (i: number): SpellDefinition | undefined => {
      const id = player.isGrimoireSlotOpen(i) ? player.grimoire[i]?.spellId : null;
      return id ? lookupSpell(engine, id) : undefined;
    };
    const centerShapes = Boolean(config.centerCostPerNeighbor || config.centerPowerPerNeighbor);
    const pairs: Array<{ a: number; b: number; reasons: string[] }> = [];
    for (let a = 0; a < GRIMOIRE_SIZE; a++) {
      for (const b of this.getOrthogonalNeighbors(a)) {
        if (b < a) continue;
        const sa = spellAt(a);
        const sb = spellAt(b);
        if (!sa || !sb) continue;
        const reasons: string[] = [];
        if (centerShapes && (a === CENTER_SLOT_INDEX || b === CENTER_SLOT_INDEX)) {
          reasons.push(`${config.centerSlotLabel ?? 'Center'} draws on its neighbor`);
        }
        if (ELEMENT_OPPOSITES[sa.element as ElementType] === sb.element) reasons.push(`${sa.element} beside ${sb.element}: more power`);
        const ray = (s: SpellDefinition) => s.targetingMode === 'ray';
        const burst = (s: SpellDefinition) => s.targetingMode === 'area_burst';
        if ((ray(sa) && burst(sb)) || (ray(sb) && burst(sa))) reasons.push('a ray beside a burst bursts on impact');
        if (reasons.length > 0) pairs.push({ a, b, reasons });
      }
    }
    return pairs;
  }

  /**
   * The player's spell as a cast of it resolves right now, for what the HUD shows: through
   * its slot on the active page (as `CastSpellAction` does), else unmodified, with the mana
   * cost the cast will charge (`effectiveManaCost`: perks and worn discounts). Undefined for
   * an unknown spell id.
   */
  public static resolveCast(engine: GameEngine, player: Player, spellId: string): EffectiveSpell | undefined {
    const base = lookupSpell(engine, spellId);
    if (!base) return undefined;
    const slot = getGrimoireConfig(engine) ? this.findSlotForSpell(player, spellId) : undefined;
    const slotted = slot !== undefined ? this.resolveEffectiveSpellDetailed(engine, player, slot) : undefined;
    const cast = slotted ?? { spell: base, notes: [], retreatSteps: 0 };
    const spell = withSpellRangeBonus(player, cast.spell);
    return { ...cast, spell: { ...spell, manaCost: effectiveManaCost(player, spell) } };
  }

  /** The spell cast from `slotIndex` after grid synergies, or undefined if the slot is empty or the grid is off. */
  public static resolveEffectiveSpell(engine: GameEngine, player: Player, slotIndex: number): SpellDefinition | undefined {
    return this.resolveEffectiveSpellDetailed(engine, player, slotIndex)?.spell;
  }

  /**
   * The spell cast from `slotIndex` after grid synergies, with a plain note per synergy that
   * changed it (for the spellbook) and how far a glyph steps the caster back after casting.
   */
  public static resolveEffectiveSpellDetailed(
    engine: GameEngine,
    player: Player,
    slotIndex: number
  ): EffectiveSpell | undefined {
    const config = getGrimoireConfig(engine);
    if (!config) return undefined;
    const grimoire = player.grimoire;
    const slot = grimoire[slotIndex];
    if (!slot || !slot.spellId || !player.isGrimoireSlotOpen(slotIndex)) return undefined;

    const baseSpell = lookupSpell(engine, slot.spellId);
    if (!baseSpell) return undefined;

    // Clone to prevent mutating global definition
    const spell: SpellDefinition = {
      ...baseSpell,
      effects: [...baseSpell.effects],
    };
    const notes: string[] = [];
    let retreatSteps = 0;
    // Each neighbor synergy counts this many times (Galdr-Master: once more, `grimoireSynergyRepeats`).
    const times = 1 + sumWorn(player, 'grimoireSynergyRepeats');

    const neighbors = this.getOrthogonalNeighbors(slotIndex)
      .filter((idx) => player.isGrimoireSlotOpen(idx))
      .map((idx) => grimoire[idx]?.spellId)
      .filter((id): id is string => Boolean(id))
      .map((id) => lookupSpell(engine, id))
      .filter((s): s is SpellDefinition => Boolean(s));

    // Center slot: more mana and more power per occupied neighbor
    if (slotIndex === CENTER_SLOT_INDEX && neighbors.length > 0) {
      const cost = (config.centerCostPerNeighbor ?? 0) * neighbors.length;
      const power = (config.centerPowerPerNeighbor ?? 0) * neighbors.length * times;
      if (cost) spell.manaCost = Math.round(spell.manaCost * (1 + cost));
      if (power) scaleSpellPower(spell, 1 + power);
      if (cost || power) {
        notes.push(`${config.centerSlotLabel ?? 'Center'}: ${neighbors.length} neighbor${neighbors.length > 1 ? 's' : ''}, +${Math.round(cost * 100)}% mana, +${Math.round(power * 100)}% power`);
      }
    }

    // Elemental Adjacency Synergies
    const opposed = ELEMENT_OPPOSITES[spell.element as ElementType];
    for (const neighbor of neighbors) {
      // Next to its opposing element (e.g. fire beside cold): more power
      if (opposed && neighbor.element === opposed) {
        const mult = Math.pow(config.opposedElementPowerMultiplier ?? DEFAULT_OPPOSED_ELEMENT_POWER, times);
        scaleSpellPower(spell, mult);
        notes.push(`Beside ${neighbor.name} (${neighbor.element}): ×${Math.round(mult * 100) / 100} power`);
      }

      // Ray adjacent to Burst -> Expands AoE
      if (spell.targetingMode === 'ray' && neighbor.targetingMode === 'area_burst') {
        spell.areaOfEffect = Math.max(times, (spell.areaOfEffect ?? 0) + times);
        notes.push(`Beside ${neighbor.name} (burst): bursts on impact`);
      }
    }

    // Grounded slot: a spell of the slot's element draws on it
    const ground = player.grimoireGrounds[slotIndex];
    if (ground && ground === spell.element && config.groundedModifier) {
      retreatSteps += applySpellModifier(spell, config.groundedModifier);
      notes.push(`Grounded in ${ground}`);
    }

    // Glyphs inscribed at altars
    for (const glyph of slot.infusedGlyphs ?? []) {
      const def = config.glyphs?.find((g) => g.id === glyph.glyphId);
      if (!def) continue;
      retreatSteps += applySpellModifier(spell, def.modifier, glyph.potency);
      notes.push(`Glyph: ${def.name}${glyph.potency > 1 ? ` ×${glyph.potency}` : ''} (${def.description})`);
    }

    return { spell, notes, retreatSteps };
  }

  /**
   * Checks whether the player can swap grimoire pages instantaneously without concentration.
   * Allowed only when in town (Floor 0) or when no hostile monsters are in line-of-sight.
   */
  public static canSwitchPageInstantly(engine: GameEngine, player: Player): boolean {
    if (engine.currentFloor === 0) return true;
    const entities = engine.map.getAllEntities();
    for (const e of entities) {
      if (e.isAlive() && e.isHostileTo(player) && engine.fov.isVisible(e.x, e.y)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Starts or continues a channeled attunement to switch active grimoire pages.
   * Out of combat (or in town) the switch is instant and free. With hostiles in view it
   * starts a 2-turn channel; the status handler below completes it on its final tick, and
   * damage interrupts it. Choosing the page again mid-channel just sustains it for a turn.
   */
  public static startOrContinueAttunement(
    engine: GameEngine,
    player: Player,
    targetPageIndex: number
  ): { success: boolean; completed: boolean; consumesTurn: boolean; message: string } {
    if (targetPageIndex < 0 || targetPageIndex >= player.grimoirePages.length) {
      return { success: false, completed: false, consumesTurn: false, message: 'Invalid grimoire page.' };
    }
    const pageName = getGrimoirePageName(engine, player, targetPageIndex);
    if (targetPageIndex === player.activeGrimoireIndex) {
      player.statusManager.removeStatus(GRIMOIRE_ATTUNE_STATUS);
      return { success: true, completed: true, consumesTurn: false, message: `Already attuned to ${pageName}.` };
    }

    // Instant switch if no hostiles in FOV or in town
    if (this.canSwitchPageInstantly(engine, player)) {
      player.statusManager.removeStatus(GRIMOIRE_ATTUNE_STATUS);
      player.switchGrimoirePage(targetPageIndex);
      const msg = `You open your grimoire to ${pageName}.`;
      engine.log(msg);
      return { success: true, completed: true, consumesTurn: false, message: msg };
    }

    // Already channeling toward this page: spend the turn sustaining it.
    const effect = player.statusManager.getStatus(GRIMOIRE_ATTUNE_STATUS);
    if (effect && effect.data?.targetPageIndex === targetPageIndex) {
      const msg = `You hold your focus on ${pageName}...`;
      engine.log(msg);
      return { success: true, completed: false, consumesTurn: true, message: msg };
    }

    // Initiate a new channel (replacing one aimed at a different page)
    player.statusManager.removeStatus(GRIMOIRE_ATTUNE_STATUS);
    const duration = 2;
    player.statusManager.applyStatus(
      {
        type: GRIMOIRE_ATTUNE_STATUS,
        duration,
        potency: 1,
        sourceEntityId: player.id,
        data: { targetPageIndex, lastHp: player.hp },
      },
      player.statusImmunities,
      player,
      engine
    );
    const msg = `Hostiles in sight! You begin a ${duration}-turn concentration ritual to attune to ${pageName}...`;
    engine.log(msg);
    return { success: true, completed: false, consumesTurn: true, message: msg };
  }

  /**
   * Interrupts an active grimoire attunement channel.
   */
  public static interruptAttunement(engine: GameEngine, player: Player, message: string): void {
    if (!player.statusManager.hasStatus(GRIMOIRE_ATTUNE_STATUS)) return;
    player.statusManager.removeStatus(GRIMOIRE_ATTUNE_STATUS);
    engine.log(message);
  }
}

const grimoireAttuneStatusHandler: StatusHandler = {
  onTick(entity: Entity, effect: StatusEffect, engine: GameEngine): StatusTickOutput {
    if (entity === engine.player) {
      const player = engine.player;
      const lastHp = typeof effect.data?.lastHp === 'number' ? effect.data.lastHp : player.hp;
      if (player.hp < lastHp) {
        GrimoireMatrixManager.interruptAttunement(engine, player, 'Pain shatters your focus! The grimoire attunement fizzles!');
        return { damageTaken: 0, killed: false };
      }
      effect.data = { ...effect.data, lastHp: player.hp };
      if (effect.duration > 1) {
        engine.log(`Concentrating on grimoire attunement... (${effect.duration - 1} turn remaining)`);
      } else {
        // Final tick. Switch here: by onExpire the effect (and its target page) is already gone.
        const targetIndex = Number(effect.data?.targetPageIndex) || 0;
        player.switchGrimoirePage(targetIndex);
        const pageName = getGrimoirePageName(engine, player, targetIndex);
        engine.log(`*** Grimoire attunement complete! Switched to ${pageName}! ***`);
      }
    }
    return { damageTaken: 0, killed: false };
  },

  // Completion is logged on the final tick; returning nothing suppresses the generic "worn off" line.
  onExpire(): string | undefined {
    return undefined;
  },
};

export function registerGrimoireAttuneStatusHandler(): void {
  StatusHandlerRegistry.register(GRIMOIRE_ATTUNE_STATUS, grimoireAttuneStatusHandler);
}

registerGrimoireAttuneStatusHandler();

