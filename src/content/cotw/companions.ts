import type { CompanionDefinition } from '../../engine/entities/companion';

export const COTW_COMPANIONS: CompanionDefinition[] = [
  {
    id: 'battle_hound',
    name: 'Fenrir-kin Battle-Hound',
    stats: { hp: 30, maxHp: 30, attack: 6, defense: 2 },
    speed: 110,
    packWeightCapacity: 15000, // 15kg — a loyal pack-mule, lighter than the player's own pack
    packBulkCapacity: 12000, // 12L
  },
];
