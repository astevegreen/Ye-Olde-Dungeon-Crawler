export type MonsterMasteryTier = 0 | 1 | 2 | 3;

/** Kills of one monster type that complete its bestiary page: knowledge rank 3, "Studied" (Q7 "A"). */
export const SPECIES_MASTERY_KILLS = 15;

/** Anatomist's own critical chance: cotw sets no base crit, so the perk carries one (tracker 3.5). */
export const ANATOMIST_CRIT_CHANCE = 0.1;

/**
 * Which mastery a perk was chosen for. Since Q7 "A" (tracker 3.5) only a monster category
 * (family) grants perks; species kills unlock knowledge ranks. 'species' remains in the type
 * for old saves and events, and is refused by `selectMasteryPerk`.
 */
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
    description: 'Ignores 50% of the foe\'s defense, and one blow in ten lands as a critical for half again as much.',
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
    // {mana} is the pack's spell-resource name, filled in where the text is shown.
    description: 'Each kill restores 10% Max HP and 10% Max {mana}, and refunds half a turn of energy.',
  },
  plunderer: {
    id: 'plunderer',
    name: 'Plunderer',
    icon: '💰',
    tagline: 'Leave nothing behind: twice the coin, and never empty-handed.',
    description: 'Doubles coin dropped and guarantees at least one loot drop from creatures that carry loot.',
  },
};

export interface CompendiumEntry {
  definitionId: string;
  name: string;
  kills: number;
  tier: MonsterMasteryTier;
  firstEncounterFloor?: number;
  /** The player has performed this monster's kill rite at least once. */
  ritePerformed?: boolean;
  /** The rank bought from a sage (tracker 4.1): the entry's tier never falls below it. */
  studiedTier?: MonsterMasteryTier;
}

export interface SerializedCompendiumRecord {
  kills: number;
  tier: MonsterMasteryTier;
  /** A rank bought by Study, kept though the kills fall short of it. */
  studiedTier?: MonsterMasteryTier;
  firstEncounterFloor?: number;
  /** Read only: a species perk from before Q7 "A", moved to its family on load (`convertSpeciesPerks`). */
  chosenPerk?: MasteryPerkId;
  ritePerformed?: boolean;
  /** Read only: this flag's name before the kill-rite rename. */
  galdrHarvested?: boolean;
}

export type SerializedCompendium = Record<string, SerializedCompendiumRecord>;
