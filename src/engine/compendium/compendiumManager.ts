import type {
  CompendiumEntry,
  MonsterMasteryTier,
  SerializedCompendium,
  MasteryPerkId,
} from './types';
import { MASTERY_PERKS } from './types';
import type { GameEngine } from '../engine';

export class CompendiumManager {
  private entries: Map<string, CompendiumEntry> = new Map();

  constructor(initialData?: SerializedCompendium) {
    if (initialData) {
      this.deserialize(initialData);
    }
  }

  /**
   * Records that a monster was encountered (e.g. seen in player's FOV).
   * Advances Tier 0 (Undiscovered) to Tier 1 (Encountered).
   */
  public recordEncounter(
    definitionId: string,
    name?: string,
    floor?: number
  ): { advanced: boolean; entry: CompendiumEntry } {
    let entry = this.entries.get(definitionId);

    if (!entry) {
      entry = {
        definitionId,
        name: name ?? definitionId,
        kills: 0,
        tier: 1,
        firstEncounterFloor: floor,
      };
      this.entries.set(definitionId, entry);
      return { advanced: true, entry };
    }

    if (name && entry.name === definitionId) {
      entry.name = name;
    }

    if (entry.tier === 0) {
      entry.tier = 1;
      if (floor !== undefined && entry.firstEncounterFloor === undefined) {
        entry.firstEncounterFloor = floor;
      }
      return { advanced: true, entry };
    }

    return { advanced: false, entry };
  }

  /**
   * Records a kill for a monster type.
   * Increments kill count and updates mastery tier:
   * - 1st kill: Advances to Tier 2 (First Slain).
   * - 5th kill: Advances to Tier 3 (Mastered).
   */
  public recordKill(
    definitionId: string,
    name?: string
  ): {
    kills: number;
    tier: MonsterMasteryTier;
    previousTier: MonsterMasteryTier;
    tierAdvanced: boolean;
  } {
    let entry = this.entries.get(definitionId);

    if (!entry) {
      entry = {
        definitionId,
        name: name ?? definitionId,
        kills: 0,
        tier: 1,
      };
      this.entries.set(definitionId, entry);
    }

    if (name && entry.name === definitionId) {
      entry.name = name;
    }

    const previousTier = entry.tier;
    entry.kills += 1;

    let tierAdvanced = false;
    if (entry.kills >= 5 && entry.tier < 3) {
      entry.tier = 3;
      tierAdvanced = true;
    } else if (entry.kills >= 1 && entry.tier < 2) {
      entry.tier = 2;
      tierAdvanced = true;
    }

    return {
      kills: entry.kills,
      tier: entry.tier,
      previousTier,
      tierAdvanced,
    };
  }

  public getEntry(definitionId: string): CompendiumEntry {
    const existing = this.entries.get(definitionId);
    if (existing) {
      return { ...existing };
    }
    return {
      definitionId,
      name: definitionId,
      kills: 0,
      tier: 0,
    };
  }

  public getAllEntries(): CompendiumEntry[] {
    return Array.from(this.entries.values()).map((e) => ({ ...e }));
  }

  public getTier(definitionId: string): MonsterMasteryTier {
    return this.entries.get(definitionId)?.tier ?? 0;
  }

  public hasMastery(definitionId: string): boolean {
    return this.getTier(definitionId) === 3;
  }

  public getPerk(definitionId: string): MasteryPerkId | undefined {
    return this.entries.get(definitionId)?.chosenPerk;
  }

  public selectPerk(
    definitionId: string,
    perkId: MasteryPerkId,
    inTown: boolean
  ): { success: boolean; reason?: string } {
    const entry = this.entries.get(definitionId);
    if (!entry || entry.tier < 3) {
      return {
        success: false,
        reason: 'Creature must reach Tier 3 (Mastery: 5+ kills) to select a specialization.',
      };
    }

    if (entry.chosenPerk && entry.chosenPerk !== perkId && !inTown) {
      return {
        success: false,
        reason: 'Mastery specializations can only be changed while safely resting in Town.',
      };
    }

    entry.chosenPerk = perkId;
    return { success: true };
  }

  public setPerk(
    definitionId: string,
    perkId: MasteryPerkId,
    inTown: boolean
  ): { success: boolean; reason?: string } {
    return this.selectPerk(definitionId, perkId, inTown);
  }

  /**
   * Returns +1 flat attack damage if Tier 3 mastery is unlocked with 'anatomist' specialization.
   */
  public getMasteryDamageBonus(definitionId: string): number {
    return this.getPerk(definitionId) === 'anatomist' ? 1 : 0;
  }

  /**
   * Returns 0.10 (+10%) evasion chance if Tier 3 mastery is unlocked with 'survivor' specialization.
   */
  public getMasteryEvasionBonus(definitionId: string): number {
    return this.getPerk(definitionId) === 'survivor' ? 0.10 : 0;
  }

  public serialize(): SerializedCompendium {
    const result: SerializedCompendium = {};
    for (const [id, entry] of this.entries.entries()) {
      result[id] = {
        kills: entry.kills,
        tier: entry.tier,
        firstEncounterFloor: entry.firstEncounterFloor,
        chosenPerk: entry.chosenPerk,
      };
    }
    return result;
  }

  public deserialize(data?: SerializedCompendium): void {
    if (!data) return;
    for (const [id, record] of Object.entries(data)) {
      const existing = this.entries.get(id);
      if (existing) {
        existing.kills = record.kills;
        existing.tier = record.tier;
        existing.firstEncounterFloor = record.firstEncounterFloor ?? existing.firstEncounterFloor;
        existing.chosenPerk = record.chosenPerk ?? existing.chosenPerk;
      } else {
        this.entries.set(id, {
          definitionId: id,
          name: id,
          kills: record.kills,
          tier: record.tier,
          firstEncounterFloor: record.firstEncounterFloor,
          chosenPerk: record.chosenPerk,
        });
      }
    }
  }
}

/**
 * Public presentation-facing helper to assign a creature's mastery perk
 * with town-safety checks, game event dispatching, and engine logging.
 */
export function selectMasteryPerk(
  engine: GameEngine,
  definitionId: string,
  perkId: MasteryPerkId
): { success: boolean; reason?: string } {
  const compendium = engine.compendium;
  if (!compendium) {
    return { success: false, reason: 'Compendium is unavailable.' };
  }

  const inTown = engine.currentFloor === 0;
  const result = compendium.selectPerk(definitionId, perkId, inTown);
  if (result.success) {
    const perk = MASTERY_PERKS[perkId];
    engine.log(`*** Mastery Specialization: Adopted ${perk.name} for ${definitionId}! ***`);
    engine.emitGameEvent({
      type: 'mastery_perk_selected',
      turn: engine.turnCount,
      data: { definitionId, perkId },
    });
  }
  return result;
}

