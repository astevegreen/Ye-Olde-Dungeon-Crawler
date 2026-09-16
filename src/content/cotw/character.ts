import type { StarterKitDefinition } from '../../engine';

export const COTW_STARTER_KIT: StarterKitDefinition = {
  weaponItemId: 'dagger',
  purseItemId: 'coin_purse',
  coins: [
    { denomination: 'copper', count: 50 },
    { denomination: 'silver', count: 10 },
    { denomination: 'gold', count: 2 },
  ],
  beltItemId: 'utility_belt',
  beltSlotItemIds: ['wand_lightning'],
  packItemIds: ['travel_bread', 'health_potion', 'mana_potion', 'scroll_phase_door', 'rune_of_return'],
};
