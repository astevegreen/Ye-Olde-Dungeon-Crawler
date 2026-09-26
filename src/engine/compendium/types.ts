export type MonsterMasteryTier = 0 | 1 | 2 | 3;

export type MasteryPerkId =
  | 'anatomist'
  | 'survivor'
  | 'trophy_hunter'
  | 'essence_siphon'
  | 'plunderer';

export interface MasteryPerkInfo {
  id: MasteryPerkId;
  name: string;
  icon: string;
  tagline: string;
  description: string;
}

export const MASTERY_PERKS: Record<MasteryPerkId, MasteryPerkInfo> = {
  anatomist: {
    id: 'anatomist',
    name: 'Anatomist',
    icon: '🗡️',
    tagline: 'Strike where the bone is thin.',
    description: '+25% Critical Hit damage bonus and ignores 50% of the creature\'s defense.',
  },
  survivor: {
    id: 'survivor',
    name: 'Survivor',
    icon: '🛡️',
    tagline: 'Read their tells; anticipate the blow.',
    description: '+10% evasion against this creature, debuff durations halved, and +25% chance to resist afflictions.',
  },
  trophy_hunter: {
    id: 'trophy_hunter',
    name: 'Trophy Hunter',
    icon: '🏹',
    tagline: 'A clean carve preserves vital organs.',
    description: '35% chance on kill to harvest a rare monster trophy or organ that sells for valuable gold in town.',
  },
  essence_siphon: {
    id: 'essence_siphon',
    name: 'Essence Siphon',
    icon: '✨',
    tagline: 'Draw vitality from the creature\'s dying breath.',
    description: 'Slaying this creature restores 10% Max HP and 10% Max Mana, and refunds 50% turn energy.',
  },
  plunderer: {
    id: 'plunderer',
    name: 'Plunderer',
    icon: '💰',
    tagline: 'Leave nothing behind; uncover hidden caches.',
    description: 'Doubles gold dropped (+100% coin value) and guarantees extra loot drops with no empty duds.',
  },
};

export interface CompendiumEntry {
  definitionId: string;
  name: string;
  kills: number;
  tier: MonsterMasteryTier;
  firstEncounterFloor?: number;
  chosenPerk?: MasteryPerkId;
}

export interface SerializedCompendiumRecord {
  kills: number;
  tier: MonsterMasteryTier;
  firstEncounterFloor?: number;
  chosenPerk?: MasteryPerkId;
}

export type SerializedCompendium = Record<string, SerializedCompendiumRecord>;

export interface MasteryCombatPerks {
  damageBonus: number;
  evasionChance: number;
}
