import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Player } from '../entities/player';
import type { SpellDefinition } from './types';
import { getSpell } from './spellRegistry';
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
export const NEXUS_SLOT_INDEX = 4; // Midgard (center: row 1, col 1)
export const DEFAULT_GRIMOIRE_PAGES = 3;
export const DEFAULT_GRIMOIRE_PAGE_NAMES = [
  'Page I: Sol',
  'Page II: Máni',
  'Page III: Yggdrasil',
] as const;

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
   * Calculates the effective, matrix-modified SpellDefinition when cast from a slot.
   */
  public static resolveEffectiveSpell(
    engine: GameEngine,
    player: Player,
    slotIndex: number
  ): SpellDefinition | undefined {
    const grimoire = player.grimoire ?? GrimoireMatrixManager.createDefaultGrimoire(player.spellsKnown);
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

    // Nexus Rule (Center Slot 4: Midgard)
    if (slotIndex === NEXUS_SLOT_INDEX && neighbors.length > 0) {
      effective.manaCost = Math.round(effective.manaCost * (1 + neighbors.length * 0.15));
      effective.description = `${effective.description} [Runic Nexus: Multi-element resonance]`;
    }

    // Elemental Adjacency Synergies
    for (const neighbor of neighbors) {
      // Fire next to Cold -> Thermal Shock
      if (
        (effective.element === 'fire' && neighbor.element === 'cold') ||
        (effective.element === 'cold' && neighbor.element === 'fire')
      ) {
        effective.basePower = Math.round((effective.basePower ?? 10) * 1.25);
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
    sacSlot.spellId = null;
    player.spellsKnown = player.spellsKnown.filter((id) => id !== sacSpellId);
    tgtSlot.infusedGlyphs.push(glyph);

    return {
      success: true,
      glyph,
      message: `*** RITE OF THE ASH TREE! ${sacName} was consumed on the altar. Its essence (${glyphType}) is permanently grafted onto ${tgtSlot.spellId}! ***`,
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

    // Remove both spells
    player.spellsKnown = player.spellsKnown.filter((id) => id !== spellAId && id !== spellBId);
    sB.spellId = null;

    // Place hybrid in slot A
    sA.spellId = hybridSpell.id;
    player.learnSpell(hybridSpell.id);

    return {
      success: true,
      message: `*** PRIMORDIAL TRANSMUTATION! The cosmic synthesis of ${spellAId} and ${spellBId} forged ${hybridSpell.name}! ***`,
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
   * If out of combat, performs an instant switch.
   * If in combat, requires concentration turns (like Rune of Return) that can be interrupted by damage.
   */
  public static startOrContinueAttunement(
    engine: GameEngine,
    player: Player,
    targetPageIndex: number
  ): { success: boolean; completed: boolean; message: string } {
    if (targetPageIndex < 0 || targetPageIndex >= player.grimoirePages.length) {
      return { success: false, completed: false, message: 'Invalid grimoire page.' };
    }
    if (targetPageIndex === player.activeGrimoireIndex) {
      const pageName = player.grimoirePages[targetPageIndex]?.name ?? `Page ${targetPageIndex + 1}`;
      return { success: true, completed: true, message: `Already attuned to ${pageName}.` };
    }

    const pageName = player.grimoirePages[targetPageIndex]?.name ?? `Page ${targetPageIndex + 1}`;

    // Instant switch if no hostiles in FOV or in town
    if (this.canSwitchPageInstantly(engine, player)) {
      player.switchGrimoirePage(targetPageIndex);
      const msg = `You open your grimoire to ${pageName}. Arcane matrix attuned.`;
      engine.log(msg);
      return { success: true, completed: true, message: msg };
    }

    // Mid-conflict attunement channel
    const effect = player.statusManager.getStatus(GRIMOIRE_ATTUNE_STATUS);
    if (effect) {
      const lastHp = typeof effect.data?.lastHp === 'number' ? effect.data.lastHp : player.hp;
      if (player.hp < lastHp) {
        this.interruptAttunement(engine, player, 'Pain shatters your focus! The grimoire attunement fizzles!');
        return { success: false, completed: false, message: 'Attunement interrupted by damage.' };
      }
      effect.data = { ...effect.data, lastHp: player.hp };

      const finalPageIndex = typeof effect.data?.targetPageIndex === 'number' ? effect.data.targetPageIndex : targetPageIndex;
      const finalPageName = player.grimoirePages[finalPageIndex]?.name ?? `Page ${finalPageIndex + 1}`;
      player.statusManager.removeStatus(GRIMOIRE_ATTUNE_STATUS);
      player.switchGrimoirePage(finalPageIndex);
      const msg = `*** Grimoire attunement complete! Your arcane resonance shifts to ${finalPageName}! ***`;
      engine.log(msg);
      return { success: true, completed: true, message: msg };
    }

    // Initiate new channel
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
    const msg = `Hostiles in sight! You begin a 2-turn concentration ritual to attune to ${pageName}...`;
    engine.log(msg);
    return { success: true, completed: false, message: msg };
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
      }
    }
    return { damageTaken: 0, killed: false };
  },

  onExpire(entity: Entity, engine: GameEngine): string | undefined {
    if (entity === engine.player) {
      const player = engine.player;
      const effect = player.statusManager.getStatus(GRIMOIRE_ATTUNE_STATUS);
      const targetIndex = Number(effect?.data?.targetPageIndex) || 0;
      player.switchGrimoirePage(targetIndex);
      const pageName = player.grimoirePages[targetIndex]?.name ?? `Page ${targetIndex + 1}`;
      const msg = `*** Grimoire attunement complete! Switched to ${pageName}! ***`;
      engine.log(msg);
      return msg;
    }
    return undefined;
  },
};

export function registerGrimoireAttuneStatusHandler(): void {
  StatusHandlerRegistry.register(GRIMOIRE_ATTUNE_STATUS, grimoireAttuneStatusHandler);
}

registerGrimoireAttuneStatusHandler();

