export type MonsterMasteryTier = 0 | 1 | 2 | 3;

export interface CompendiumEntry {
  definitionId: string;
  name: string;
  kills: number;
  tier: MonsterMasteryTier;
  firstEncounterFloor?: number;
}

export interface SerializedCompendiumRecord {
  kills: number;
  tier: MonsterMasteryTier;
  firstEncounterFloor?: number;
}

export type SerializedCompendium = Record<string, SerializedCompendiumRecord>;

export interface MasteryCombatPerks {
  damageBonus: number;
  evasionChance: number;
}
