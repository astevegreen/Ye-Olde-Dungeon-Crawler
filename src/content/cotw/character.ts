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
  packItemIds: ['hearth_broth_flask', 'birch_tar_poultice', 'scroll_phase_door'],
  // Kill rites teach the rest as the hero descends (killRites.ts).
  spellsKnown: ['magic_arrow', 'heal_minor'],
};
