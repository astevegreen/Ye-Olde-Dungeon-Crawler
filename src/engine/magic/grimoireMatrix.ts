import type { GameEngine } from '../engine';
import type { Player } from '../entities/player';
import type { SpellDefinition } from './types';
import { getSpell } from './spellRegistry';

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

export const GRIMOIRE_SIZE = 9;
export const NEXUS_SLOT_INDEX = 4; // Midgard (center: row 1, col 1)

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
}
