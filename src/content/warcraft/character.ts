import type { StarterKitDefinition } from '../../engine/types/manifest';

export const WARCRAFT_STARTER_KIT: StarterKitDefinition = {
  weaponItemId: 'warhammer',
  purseItemId: 'purse',
  coins: [
    { denomination: 'copper', count: 40 },
    { denomination: 'silver', count: 12 },
    { denomination: 'gold', count: 5 },
  ],
  beltItemId: 'utility_belt',
  beltSlotItemIds: [],
  packItemIds: ['health_potion', 'mana_potion'],
  spellsKnown: ['chain_lightning', 'holy_light', 'bloodlust', 'blinking'],
};
