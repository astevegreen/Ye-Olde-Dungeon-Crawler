import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';
import type { SpellDefinition } from './types';
import { getSpell } from './spellRegistry';
import { ELEMENT_OPPOSITES, type ElementType } from './elements';
import type { GrimoireConfig } from './magicConfig';
import { StatusHandlerRegistry } from '../status/statusHandlers';
import type { StatusHandler, StatusTickOutput } from '../status/statusHandlers';
import type { StatusEffect } from '../status/types';

export type InfusionGlyphType =
  | 'vanish_step'
  | 'all_seeing'
  | 'lethargic'
  | 'martyrs_osmosis'
  | 'concussive_blast';

export interface InfusedGlyph {
  type: InfusionGlyphType;
  potency: number;
  sourceSpellName: string;
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

export class GrimoireMatrixManager {
  /**
   * Initializes a default 9-slot grimoire, placing initial known spells into slots.
   */
  public static createDefaultGrimoire(spellsKnown: string[] = []): GrimoireSlot[] {
    const slots: GrimoireSlot[] = [];
    for (let i = 0; i < GRIMOIRE_SIZE; i++) {
      slots.push({
        slotIndex: i,
        spellId: spellsKnown[i] ?? null,
      });
    }
    return slots;
  }

  /**
   * Initializes a default set of swappable grimoire pages.
   * Page 0 holds initial known spells; subsequent pages start blank for deckbuilding.
   */
  public static createDefaultGrimoirePages(spellsKnown: string[] = []): GrimoirePage[] {
    return DEFAULT_GRIMOIRE_PAGE_NAMES.map((name, index) => ({
      id: `page_${index + 1}`,
      name,
      slots: index === 0 ? this.createDefaultGrimoire(spellsKnown) : this.createDefaultGrimoire([]),
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
   * Calculates the effective, matrix-modified SpellDefinition when cast from a slot.
   */
  public static resolveEffectiveSpell(
    engine: GameEngine,
    player: Player,
    slotIndex: number
  ): SpellDefinition | undefined {
    const config = getGrimoireConfig(engine);
    if (!config) return undefined;
    const grimoire = player.grimoire;
    const slot = grimoire[slotIndex];
    if (!slot || !slot.spellId) return undefined;

    const baseSpell = engine.manifest?.spells?.find((s) => s.id === slot.spellId) ?? getSpell(slot.spellId);
    if (!baseSpell) return undefined;

    // Clone to prevent mutating global definition
    const effective: SpellDefinition = {
      ...baseSpell,
      effects: baseSpell.effects ? [...baseSpell.effects] : undefined,
    };

    const neighbors = this.getOrthogonalNeighbors(slotIndex)
      .map((idx) => grimoire[idx]?.spellId)
      .filter((id): id is string => Boolean(id))
      .map((id) => engine.manifest?.spells?.find((s) => s.id === id) ?? getSpell(id))
      .filter((s): s is SpellDefinition => Boolean(s));

    // Center slot: costs more mana per occupied neighbor
    if (slotIndex === CENTER_SLOT_INDEX && neighbors.length > 0 && config.centerCostPerNeighbor) {
      effective.manaCost = Math.round(effective.manaCost * (1 + neighbors.length * config.centerCostPerNeighbor));
    }

    // Elemental Adjacency Synergies
    const opposed = ELEMENT_OPPOSITES[effective.element as ElementType];
    for (const neighbor of neighbors) {
      // Next to its opposing element (e.g. fire beside cold): more power
      if (opposed && neighbor.element === opposed) {
        const mult = config.opposedElementPowerMultiplier ?? DEFAULT_OPPOSED_ELEMENT_POWER;
        effective.basePower = Math.round((effective.basePower ?? 10) * mult);
        // Damage comes from the damage effects, not basePower, so scale those too.
        effective.effects = effective.effects?.map((e) =>
          e.type === 'damage' && typeof e.amount === 'number' ? { ...e, amount: Math.round(e.amount * mult) } : e
        );
      }

      // Ray adjacent to Burst -> Expands AoE
      if (effective.targetingMode === 'ray' && neighbor.targetingMode === 'area_burst') {
        effective.areaOfEffect = Math.max(1, (effective.areaOfEffect ?? 0) + 1);
      }
    }

    // Apply Infused Glyphs from Sacrifice
    if (slot.infusedGlyphs) {
      for (const glyph of slot.infusedGlyphs) {
        if (glyph.type === 'concussive_blast') {
          effective.areaOfEffect = (effective.areaOfEffect ?? 0) + glyph.potency;
        } else if (glyph.type === 'all_seeing') {
          effective.range = (effective.range ?? 5) + glyph.potency;
        }
      }
    }

    return effective;
  }

  /**
   * Permanently sacrifices a known spell at an altar to infuse its essence onto a target spell.
   */
  public static sacrificeAndInfuse(
    player: Player,
    sacrificeSlotIndex: number,
    targetSlotIndex: number
  ): { success: boolean; message: string; glyph?: InfusedGlyph } {
    if (sacrificeSlotIndex === targetSlotIndex) {
      return { success: false, message: 'Cannot sacrifice a spell into itself.' };
    }

    const grimoire = player.grimoire ?? GrimoireMatrixManager.createDefaultGrimoire(player.spellsKnown);
    const sacSlot = grimoire[sacrificeSlotIndex];
    const tgtSlot = grimoire[targetSlotIndex];

    if (!sacSlot || !sacSlot.spellId) {
      return { success: false, message: 'No spell in the sacrificial slot.' };
    }
    if (!tgtSlot || !tgtSlot.spellId) {
      return { success: false, message: 'No recipient spell in the target slot.' };
    }

    tgtSlot.infusedGlyphs = tgtSlot.infusedGlyphs ?? [];
    if (tgtSlot.infusedGlyphs.length >= 2) {
      return { success: false, message: 'Target spell already bears the maximum of 2 infusions.' };
    }

    const sacSpellId = sacSlot.spellId;
    const sacSpell = getSpell(sacSpellId);
    const sacName = sacSpell?.name ?? sacSpellId;

    // Determine glyph type from sacrificed spell properties
    let glyphType: InfusionGlyphType = 'concussive_blast';
    let potency = 1;

    if (sacSpell?.school === 'Movement') {
      glyphType = 'vanish_step';
      potency = 2;
    } else if (sacSpell?.school === 'Healing' || sacSpell?.targetingMode === 'self') {
      glyphType = 'martyrs_osmosis';
      potency = 1;
    } else if (sacSpell?.school === 'Enchantment' || sacSpell?.statusAffliction) {
      glyphType = 'lethargic';
      potency = 1;
    } else if (sacSpell?.school === 'Divination') {
      glyphType = 'all_seeing';
      potency = 2;
    } else if (sacSpell?.areaOfEffect && sacSpell.areaOfEffect > 0) {
      glyphType = 'concussive_blast';
      potency = 1;
    } else {
      glyphType = 'vanish_step';
      potency = 2;
    }

    const glyph: InfusedGlyph = {
      type: glyphType,
      potency,
      sourceSpellName: sacName,
    };

    // Permanently destroy the sacrificed spell
    player.forgetSpell(sacSpellId);
    tgtSlot.infusedGlyphs.push(glyph);

    return {
      success: true,
      glyph,
      message: `${sacName} is consumed; its essence (${glyphType}) is grafted onto ${tgtSlot.spellId}.`,
    };
  }

  /**
   * Fuses two mutually opposing spells at an altar into an occult hybrid.
   */
  public static transmuteHybrid(
    player: Player,
    slotA: number,
    slotB: number,
    hybridSpell: SpellDefinition
  ): { success: boolean; message: string } {
    const grimoire = player.grimoire ?? GrimoireMatrixManager.createDefaultGrimoire(player.spellsKnown);
    const sA = grimoire[slotA];
    const sB = grimoire[slotB];

    if (!sA?.spellId || !sB?.spellId) {
      return { success: false, message: 'Both altar slots must contain a known spell.' };
    }

    const spellAId = sA.spellId;
    const spellBId = sB.spellId;

    // Remove both spells, then place the hybrid in slot A
    player.forgetSpell(spellAId);
    player.forgetSpell(spellBId);
    player.learnSpell(hybridSpell.id); // may auto-slot into the first empty slot
    for (const slot of player.grimoire) {
      if (slot.spellId === hybridSpell.id) slot.spellId = null;
    }
    sA.spellId = hybridSpell.id;

    return {
      success: true,
      message: `${spellAId} and ${spellBId} are fused into ${hybridSpell.name}.`,
    };
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

