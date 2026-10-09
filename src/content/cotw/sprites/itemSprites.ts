import type { PixelSprite } from '../../../engine';
import { bake, type Model, type PaletteSwap } from './sculpt/kit';
import type { ItemVariant } from './sculpt/itemKit';
import { axeModel, bluntModel, daggerModel, polearmModel, staffModel, swordModel } from './sculpt/weapons';
import { bodyArmourModel, bootsModel, cloakModel, glovesModel, helmModel, shieldModel } from './sculpt/armour';
import { amuletModel, coinsModel, gemModel, keyModel, packModel, ringModel } from './sculpt/trinkets';
import { breadModel, potionModel, runeStoneModel, scrollModel, tabletModel, torchModel, wandModel } from './sculpt/consumables';
import { fangModel, hearthTearModel } from './sculpt/relics';

const sculpted = (model: Model<ItemVariant>, variant: ItemVariant = {}, frames = 1): PixelSprite => ({
  frames,
  render: (frame, size) => bake(model, { frame, px: size, variant }),
});

const sword = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(swordModel, { kind, pal });
const axe = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(axeModel, { kind, pal });
const blunt = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(bluntModel, { kind, pal });
const dagger = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(daggerModel, { kind, pal });
const body = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(bodyArmourModel, { kind, pal });
const shield = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(shieldModel, { kind, pal });
const ring = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(ringModel, { kind, pal });
const amulet = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(amuletModel, { kind, pal });
const pack = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(packModel, { kind, pal });
const potion = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(potionModel, { kind, pal });
const wand = (kind: string, pal?: ItemVariant['pal']): PixelSprite => sculpted(wandModel, { kind, pal }, 2);
const torch = (pal?: ItemVariant['pal']): PixelSprite => sculpted(torchModel, { pal }, 4);
/** A rune tablet glows in its spell's element; a darker slab tells two of one element apart. */
const tablet = (glow: string, slab?: string): PixelSprite => sculpted(tabletModel, { pal: { emArcane: glow, ...(slab ? { item_slab: slab } : {}) } }, 2);
const runeStone = (glow?: PaletteSwap, slab?: string): PixelSprite =>
  sculpted(runeStoneModel, { pal: { ...(glow ? { emArcane: glow } : {}), ...(slab ? { item_slab: slab } : {}) } }, 2);

/** Stones other than the grey slab, so two tablets of one element still differ. */
const SANDSTONE = '#8a7458';
const DARK_SLAB = '#3a3c44';

/**
 * The items, keyed by definition id, plus the archetype keys an item without its own sprite
 * falls back to. A model is a family; `kind` picks the shape and `pal` recolours it, so no two
 * definitions look the same. An item's drawing shows only its material or element: alignment
 * is the aura the game adds once the item is identified, so a cursed mace is drawn as a mace.
 * Relics without a sculpted drawing yet (Sól-Shard Focus, the World-Bark tower shield, the
 * antler mask, the Marrow-Gnawed Ring, the Duergar lodestone) keep their recipe.
 */
export const COTW_ITEM_PIXEL_SPRITES: Record<string, PixelSprite> = {
  // ---- swords, axes, blunt weapons
  shortsword: sword('short'),
  broadsword: sword('broad'),
  frost_blade: sword('frost'),
  two_handed_sword: sword('great'),
  cinder_edge_shortsword: sword('short', { steel: { base: '#8c4a30', shiny: true }, iron: 'blackIron' }),
  heartwood_longsword: sword('broad', { steel: { base: '#8a5a34', hs: 10 }, bronze: 'iron' }),
  mythril_longsword: sword('broad', { steel: { base: '#c8e2ee', shiny: true }, bronze: 'silver' }),
  adamantine_greatsword: sword('great', { steel: { base: '#4a5262', shiny: true }, iron: 'blackIron' }),
  battleaxe: axe('axe'),
  pit_draugr_pick: axe('axe', { steel: 'boneOld', silver: 'bone', wood: 'woodDark', iron: 'blackIron' }),
  rot_porous_cleaver: axe('cleaver', { iron: { base: '#3c372c', tex: 'rot' }, steel: '#77735c' }),
  cursed_mace: blunt('mace'),
  morningstar: blunt('morningstar'),
  forge_tongue_hammer: blunt('hammer'),
  duergar_slag_tongs: blunt('hammer', { iron: 'blackIron', wood: 'iron', steel: { base: '#c8642a', shiny: true } }),
  mammut_bone_cudgel: blunt('cudgel'),
  // ---- knives, polearms, staves
  dagger: dagger('seax'),
  tarnished_quicksilver_stiletto: dagger('stiletto', { steel: 'silver', iron: 'bronze' }),
  rime_bit_chisel: dagger('chisel', { steel: 'item_frost' }),
  skraeling_ice_spear: sculpted(polearmModel, { kind: 'ice' }),
  sol_brand_glaive: sculpted(polearmModel, { kind: 'glaive' }),
  ironwood_bough_stave: sculpted(staffModel),
  // ---- shields
  wooden_shield: shield('round'),
  lashed_driftwood_buckler: shield('round', { item_paint: '#8a7a62', iron: 'item_twine', wood: '#9a8a70' }),
  mirror_skulker_facet: shield('round', { item_paint: { base: '#c8d4dc', shiny: true }, wood: { base: '#9aa8b2', shiny: true } }),
  aegis_shield: shield('round', { item_paint: { base: '#c8a040', shiny: true }, wood: 'silver', iron: 'gold' }),
  iron_shield: shield('heater'),
  bellows_plate_shield: shield('heater', { iron: 'bronze' }),
  draugr_bone_ward: shield('heater', { blackIron: 'boneOld', iron: 'bone', steel: 'boneOld' }),
  steel_tower_shield: shield('heater', { iron: { base: '#8f9bab', shiny: true }, blackIron: 'bronze', steel: 'silver' }),
  // ---- body armour
  layered_fur_jerkin: body('light'),
  leather_armor: body('light', { furGrey: 'leatherDark' }),
  mammut_hide_brigandine: body('light', { leather: '#7a5a40', furGrey: 'furTawny', horn: 'bone' }),
  chainmail: body('medium'),
  cinder_quenched_hauberk: body('medium', { mail: { base: '#3a3836', shiny: true, tex: 'mail' }, bronze: 'iron' }),
  quicksilver_mesh_shirt: body('medium', { mail: { base: '#c6ced6', shiny: true, tex: 'mail' }, leather: 'leatherDark' }),
  plate_mail: body('heavy'),
  plate_armor: body('heavy', { steel: 'silver', iron: 'gold', silver: 'gold' }),
  obsidian_scale_cuirass: body('heavy', { steel: { base: '#24222c', shiny: true }, iron: '#1a1820', silver: '#6a5a8a' }),
  nid_dripping_hauberk: body('heavy', { steel: { base: '#2e3326', tex: 'rot' }, iron: '#252a20', silver: '#5a6a2a' }),
  // ---- helms
  helmet: sculpted(helmModel),
  brim_wolf_pelt_hood: sculpted(helmModel, { pal: { iron: { base: '#b8b4aa', tex: 'fur' }, bronze: 'leatherDark', mail: 'furGrey' } }),
  skraeling_bone_circlet: sculpted(helmModel, { pal: { iron: 'bone', bronze: 'boneOld', mail: 'leatherDark' } }),
  soot_visored_helm: sculpted(helmModel, { pal: { iron: 'blackIron', bronze: 'iron', mail: 'blackIron' } }),
  zealots_seared_crown: sculpted(helmModel, { pal: { iron: 'bronze', bronze: 'gold' } }),
  // ---- cloaks
  tattered_travelers_wrap: sculpted(cloakModel),
  ash_weave_mantle: sculpted(cloakModel, { pal: { wool: '#6a6a68', woolBrown: '#4a4a48', furGrey: '#8a8a86' } }),
  huldras_nettlespun_cloak: sculpted(cloakModel, { pal: { wool: '#4a5a34', woolBrown: '#6a4a2c', furGrey: 'item_herb' } }),
  sap_sealed_cape: sculpted(cloakModel, { pal: { wool: { base: '#a8682a', shiny: true }, furGrey: 'item_amber' } }),
  shroud_of_the_unburied: sculpted(cloakModel, { pal: { wool: 'linen', woolBrown: '#3a3430', furGrey: 'boneOld', bronze: 'iron' } }),
  // ---- hands and wrists
  duergar_forge_gauntlets: sculpted(glovesModel),
  frost_cracked_mitts: sculpted(glovesModel, { pal: { iron: '#8a7058', leather: '#9a8068', blackIron: 'item_frost' } }),
  glassblowers_grips: sculpted(glovesModel, { pal: { iron: 'linen', leather: '#c8b89a', blackIron: 'item_copper' } }),
  leech_skin_gloves: sculpted(glovesModel, { pal: { iron: { base: '#2a2630', shiny: true }, leather: { base: '#3a2a34', shiny: true }, blackIron: '#5a2a2a' } }),
  root_wound_bracers: sculpted(glovesModel, { pal: { iron: 'woodDark', leather: 'item_ironwood', blackIron: 'wood' } }),
  // ---- feet
  boots: sculpted(bootsModel),
  bound_hide_wrappings: sculpted(bootsModel, { pal: { leather: '#8a7058', furTawny: 'item_twine' } }),
  crampon_nailed_boots: sculpted(bootsModel, { pal: { leather: '#6a4a34', leatherDark: 'iron', furTawny: 'furGrey' } }),
  treadplate_sabatons: sculpted(bootsModel, { pal: { leather: 'iron', leatherDark: 'blackIron', furTawny: 'mail' } }),
  sure_step_mine_boots: sculpted(bootsModel, { pal: { leather: 'leatherDark', leatherDark: 'iron', furTawny: 'leather' } }),
  rootless_striders: sculpted(bootsModel, { pal: { leather: 'item_ironwood', leatherDark: 'woodDark', furTawny: 'item_herb' } }),
  // ---- belts
  utility_belt: pack('pouch'),
  braided_sinew_cord: pack('pouch', { leatherDark: 'item_twine', leather: '#8a7058', bronze: 'bone' }),
  tool_hung_smiths_girdle: pack('pouch', { leather: 'leatherDark', leatherDark: '#3a3028', bronze: 'iron' }),
  ember_pouch_sash: pack('pouch', { leatherDark: '#8a3020', leather: '#a8502c', bronze: 'item_copper' }),
  silverlode_money_belt: pack('pouch', { bronze: 'silver', leather: '#5a4030' }),
  girdle_of_thryms_line: pack('pouch', { leatherDark: 'blackIron', leather: 'leatherDark', bronze: 'gold' }),
  // ---- packs and purses
  backpack: pack('backpack'),
  dwarven_tool_frame: pack('backpack', { leather: 'iron', leatherDark: 'blackIron', woolBrown: 'leather' }),
  world_bark_satchel: pack('backpack', { leather: 'item_ironwood', leatherDark: 'woodDark', woolBrown: 'item_herb' }),
  leather_coin_pouch: pack('purse'),
  coin_purse: pack('purse', { leather: '#5a2a4a' }),
  quicksilver_lined_purse: pack('purse', { leather: { base: '#7a8088', shiny: true }, item_twine: 'silver', gold: 'silver' }),
  ironclasp_purse: pack('purse', { item_twine: 'iron', leather: 'leatherDark' }),
  grave_salt_pouch: pack('purse', { leather: '#8a8478', gold: '#d8d4cc' }),
  // ---- neck and fingers
  charm_watchful_eye: amulet('valknut'),
  corpse_chieftains_eye_coin: amulet('valknut', { bronze: '#6a6c70' }),
  wolf_tooth_thong: amulet('hammer', { silver: 'bone' }),
  nisses_pewter_porridge_spoon: amulet('hammer', { silver: '#8a8c8a' }),
  amber_heart_drop: amulet('amber'),
  sun_fragment_pendant: amulet('amber', { item_amber: { base: '#f0c040', shiny: true }, silver: 'gold' }),
  bone_carved_band: ring('bone'),
  rime_signet_of_the_hollows: ring('serpent'),
  ring_of_the_slag_walker: ring('rune'),
  duergar_vault_ring: ring('rune', { iron: 'bronze' }),
  mirror_cut_ring: ring('gold', { gold: 'silver' }),
  ring_of_the_deep_lode: ring('gold', { gold: { base: '#b8a060', shiny: true }, item_crystal: '#4a6a5a' }),
  // ---- potions, food and draughts
  health_potion: potion('heal'),
  regular_health_potion: potion('heal', { item_heal: '#8e1424', wood: 'bronze' }),
  supreme_health_potion: potion('heal', { item_heal: { base: '#e8b830', shiny: true }, wood: 'gold' }),
  bat_senses_potion: potion('heal', { item_heal: '#6a6a70' }),
  hearth_broth_flask: potion('heal', { item_glass: '#a87858', item_heal: '#8a5a2c' }),
  mana_potion: potion('mana'),
  regular_mana_potion: potion('mana', { item_mana: '#38b0e8', wood: 'bronze' }),
  cure_poison_potion: potion('mana', { item_mana: '#2a9a5a' }),
  urdr_cleansing_water: potion('mana', { item_mana: { base: '#bfe8f0', a: 0.85, shiny: true }, item_glass: 'item_crystal' }),
  draught_of_thawed_blood: potion('mana', { item_mana: '#a01818' }),
  vial_of_choke_damp: potion('mana', { item_mana: '#6a8a2a', wood: 'blackIron' }),
  bog_myrtle_tonic: potion('mana', { item_mana: '#b8862a' }),
  mead_of_suttungr: potion('mead'),
  mead_of_the_corpse_tongue: potion('mead', { horn: '#2a2622', item_mead: '#3a2a30' }),
  bellows_skin_canteen: potion('mead', { horn: 'leatherDark', item_mead: '#3a5a8a' }),
  marrow_rich_stew: potion('stew'),
  birch_tar_poultice: potion('poultice'),
  // ---- lights
  wooden_torch: torch(),
  holy_torch: torch({ wood: 'item_birch', item_twine: 'gold' }),
  zealots_sun_flare: torch({ item_pitch: 'linen', wood: 'bronze', emFire: { base: '#ffe27a', em: true, hs: 0 }, emFireCore: { base: '#fffbe0', em: true, hs: 0 } }),
  grave_wax_candle: torch({ wood: '#e8e0c8', item_pitch: '#d8d0b8', item_twine: '#d8d0b8' }),
  // ---- wands, scrolls and rune tablets
  wand_fireballs: wand('fire'),
  wand_lightning: wand('bolt'),
  wand_of_the_ironwood_bough: wand('frost', { item_birch: 'item_ironwood', silver: 'iron', emFrost: 'emPoison' }),
  scroll_identify: sculpted(scrollModel),
  scroll_phase_door: sculpted(scrollModel, { pal: { item_ink: '#3a4a8a' } }),
  scroll_teleport: sculpted(scrollModel, { pal: { item_parch: '#c8b088', item_ink: '#6a2a6a' } }),
  scroll_remove_curse: sculpted(scrollModel, { pal: { item_parch: '#e0d8c0', item_ink: '#8a2020' } }),
  tablet_phase_door: tablet('emArcane'),
  tablet_teleport: tablet('emArcane', SANDSTONE),
  tablet_firebolt: tablet('emFire'),
  tablet_fireball: tablet('emFire', SANDSTONE),
  tablet_cold_ray: tablet('emFrost'),
  tablet_slow: tablet('emFrost', SANDSTONE),
  tablet_lightning_bolt: tablet('emBolt'),
  tablet_heal_medium: tablet('emPoison'),
  tablet_paralyze: tablet('emPoison', SANDSTONE),
  tablet_identify: tablet('emHoly', SANDSTONE),
  tablet_clairvoyance: tablet('emUnholy'),
  tablet_detect_monsters: tablet('eyeRed'),
  tablet_detect_objects: tablet('emKin', DARK_SLAB),
  // ---- the Essence-Runes: each glows in its own rune's colour
  essence_uruz: runeStone({ base: '#e070c0', em: true, hs: 0 }),
  essence_ansuz: runeStone('emHoly', SANDSTONE),
  essence_kenaz: runeStone('emFire'),
  essence_isa: runeStone('emFrost'),
  essence_thurisaz: runeStone('emBolt', DARK_SLAB),
  essence_nauthiz: runeStone('eyeRed'),
  essence_berkano: runeStone('emPoison'),
  // ---- relics with their own drawing
  nidhogg_fang: sculpted(fangModel, {}, 4),
  hearth_tear_fragment: sculpted(hearthTearModel, {}, 4),

  // ---- archetype keys: what an item without its own sprite falls back to
  gold_coins: sculpted(coinsModel),
  purse: pack('purse'),
  belt: pack('pouch'),
  travel_bread: sculpted(breadModel),
  rune_stone: runeStone(),
  iron_armor: body('medium'),
  mace: blunt('mace'),
  warhammer: blunt('hammer'),
  ring: ring('gold'),
  amulet: amulet('hammer'),
  cloak: sculpted(cloakModel),
  gauntlets: sculpted(glovesModel),
  bracers: sculpted(glovesModel),
  scroll: sculpted(scrollModel),
  gem: sculpted(gemModel),
  key: sculpted(keyModel),
  torch: torch(),
};
