import type { StarterKitDefinition } from '../../engine';

export const COTW_STARTER_KIT: StarterKitDefinition = {
  weaponItemId: 'mammut_bone_cudgel',
  armorItemId: 'layered_fur_jerkin',
  bootsItemId: 'bound_hide_wrappings',
  purseItemId: 'leather_coin_pouch',
  coins: [
    { denomination: 'copper', count: 50 },
    { denomination: 'silver', count: 10 },
    { denomination: 'gold', count: 2 },
  ],
  beltItemId: 'braided_sinew_cord',
  beltSlotItemIds: ['hearth_broth_flask', 'birch_tar_poultice'],
  packItemIds: ['travel_bread', 'hearth_broth_flask', 'birch_tar_poultice', 'scroll_phase_door'],
};
