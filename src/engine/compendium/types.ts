export type MonsterMasteryTier = 0 | 1 | 2 | 3;

/** Kills of one monster type that unlock its species mastery (tier 3) and a perk choice. */
export const SPECIES_MASTERY_KILLS = 15;

/** Which mastery a perk was chosen for: one monster type, or a whole monster category. */
export type MasteryScope = 'species' | 'category';

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
    description: 'Ignores 50% of the foe\'s defense, and critical hits against it deal +25% more damage.',
  },
  survivor: {
    id: 'survivor',
    name: 'Survivor',
    icon: '🛡️',
    tagline: 'Read their tells; anticipate the blow.',
    description: '+10% evasion against the foe, 25% chance to shrug off its afflictions, and halved affliction durations.',
  },
  trophy_hunter: {
    id: 'trophy_hunter',
    name: 'Trophy Hunter',
    icon: '🏹',
    tagline: 'A clean carve preserves vital organs.',
    description: '35% chance on kill to harvest a rare trophy or organ that sells for good coin in town.',
  },
  essence_siphon: {
    id: 'essence_siphon',
    name: 'Essence Siphon',
    icon: '✨',
    tagline: 'Draw vitality from the dying breath.',
    description: 'Each kill restores 10% Max HP and 10% Max Mana, and refunds half a turn of energy.',
  },
  plunderer: {
    id: 'plunderer',
    name: 'Plunderer',
    icon: '💰',
    tagline: 'Leave nothing behind; uncover hidden caches.',
    description: 'Doubles coin dropped and guarantees at least one loot drop from creatures that carry loot.',
  },
};

export interface CompendiumEntry {
  definitionId: string;
  name: string;
  kills: number;
  tier: MonsterMasteryTier;
  firstEncounterFloor?: number;
  chosenPerk?: MasteryPerkId;
  /** The player has performed this monster's kill rite at least once. */
  ritePerformed?: boolean;
}

export interface SerializedCompendiumRecord {
  kills: number;
  tier: MonsterMasteryTier;
  firstEncounterFloor?: number;
  chosenPerk?: MasteryPerkId;
  ritePerformed?: boolean;
  /** Read only: this flag's name before the kill-rite rename. */
  galdrHarvested?: boolean;
}

export type SerializedCompendium = Record<string, SerializedCompendiumRecord>;
