import type {
  CompendiumEntry,
  MonsterMasteryTier,
  SerializedCompendium,
} from './types';

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

  /**
   * Returns +1 flat attack damage if Tier 3 mastery is unlocked.
   */
  public getMasteryDamageBonus(definitionId: string): number {
    return this.hasMastery(definitionId) ? 1 : 0;
  }

  /**
   * Returns 0.05 (+5%) evasion chance if Tier 3 mastery is unlocked.
   */
  public getMasteryEvasionBonus(definitionId: string): number {
    return this.hasMastery(definitionId) ? 0.05 : 0;
  }

  public serialize(): SerializedCompendium {
    const result: SerializedCompendium = {};
    for (const [id, entry] of this.entries.entries()) {
      result[id] = {
        kills: entry.kills,
        tier: entry.tier,
        firstEncounterFloor: entry.firstEncounterFloor,
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
      } else {
        this.entries.set(id, {
          definitionId: id,
          name: id,
          kills: record.kills,
          tier: record.tier,
          firstEncounterFloor: record.firstEncounterFloor,
        });
      }
    }
  }
}
