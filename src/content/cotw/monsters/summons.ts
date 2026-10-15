import type { MonsterDefinition } from '../../../engine';
import { DISIR_SPIRIT_ID } from '../frithMagic';
import { PACK_WOLF_ID } from '../waveOneSpells';

/**
 * Creatures that only a spell brings into the world: never drawn for a floor, never the
 * hero's kill, so no loot, no XP and no kill rite.
 */
export const SUMMONED_MONSTERS: MonsterDefinition[] = [
  {
    // The Dísir's spirits, about as strong as a floor-22 foe.
    id: DISIR_SPIRIT_ID,
    name: 'Dís',
    minFloor: 0,
    placedOnly: true,
    stats: { hp: 45, maxHp: 45, attack: 16, defense: 6 },
    speed: 100,
    aiType: 'melee',
    resistances: { shadow: 'resistant', healing: 'immune' },
    statusImmunities: ['poison', 'paralysis'],
    fleeHealthPercent: 0,
    xpValue: 0,
    tags: ['spirit'],
    lootTable: [],
  },
  {
    // Call the Pack's wolves: quick and fragile, a pair for a fight's length.
    id: PACK_WOLF_ID,
    name: 'Pack wolf',
    minFloor: 0,
    placedOnly: true,
    stats: { hp: 30, maxHp: 30, attack: 12, defense: 3 },
    speed: 120,
    aiType: 'melee',
    fleeHealthPercent: 0,
    xpValue: 0,
    tags: ['beast'],
    lootTable: [],
  },
];
