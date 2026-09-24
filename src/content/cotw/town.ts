import { Merchant } from '../../engine';
import type { TownLayoutDefinition } from '../../engine';
import { makeShopItem } from './items/makeItem';
import { TOWN_ROWS, TOWN_LEGEND, TOWN_WIDTH, TOWN_HEIGHT, TOWN_BUILDINGS, TOWN_PLAYER_SPAWN, TOWN_STAIRS_DOWN } from './townLayout';

export const COTW_TOWN: TownLayoutDefinition = {
  name: 'Bjarnarhaven',
  // A clearing in the pine woods (townLayout.ts): lanes wind between the buildings to a
  // plaza with a frozen fountain.
  width: TOWN_WIDTH,
  height: TOWN_HEIGHT,
  layout: TOWN_ROWS,
  legend: TOWN_LEGEND,
  playerSpawn: TOWN_PLAYER_SPAWN,
  stairsDown: TOWN_STAIRS_DOWN,
  buildings: TOWN_BUILDINGS,
  npcs: [
    {
      id: 'npc-olaf',
      name: 'Olaf the Chandler',
      role: 'merchant',
      shopId: 'merchant-olaf',
      position: { x: 11, y: 8 },
      greeting: 'Welcome to Olaf’s General Goods! Torches, packs, and bread for hearty souls!',
      dialogText: 'Stock up on torches and rations, traveler. The depths do not forgive an empty pack.',
      merchantConfig: {
        id: 'merchant-olaf',
        name: "Olaf's General Store",
        greeting: 'Welcome to Olaf’s General Goods! Torches, packs, and bread for hearty souls!',
        markupRatio: 1.25,
        markdownRatio: 0.5,
        initialInventory: [
          makeShopItem('wooden_torch', 'olaf-torch-1'),
          makeShopItem('wooden_torch', 'olaf-torch-2'),
          makeShopItem('travel_bread', 'olaf-bread-1'),
          makeShopItem('travel_bread', 'olaf-bread-2'),
          makeShopItem('thief_lockpicks', 'olaf-picks-1'),
          makeShopItem('sealskin_rucksack', 'olaf-pack-1'),
          makeShopItem('leather_coin_pouch', 'olaf-purse-1'),
          makeShopItem('braided_sinew_cord', 'olaf-belt-1'),
          makeShopItem('tattered_travelers_wrap', 'olaf-wrap-1'),
          makeShopItem('bound_hide_wrappings', 'olaf-boots-1'),
          makeShopItem('hearth_broth_flask', 'olaf-broth-1'),
          makeShopItem('birch_tar_poultice', 'olaf-poultice-1'),
          makeShopItem('sealskin_rucksack', 'olaf-hero-rucksack', { type: 'minFaction', faction: 'townsfolk', value: 25 }),
        ],
      },
    },
    {
      id: 'npc-gunther',
      name: 'Gunther the Smith',
      role: 'merchant',
      shopId: 'merchant-gunther',
      position: { x: 42, y: 6 },
      greeting: 'Need cold steel or sturdy plate? Gunther’s forge provides!',
      dialogText: 'Mind your guard down there. Those hill giants strike hard enough to splinter oak.',
      merchantConfig: {
        id: 'merchant-gunther',
        name: "Gunther's Armory",
        greeting: 'Need cold steel or sturdy plate? Gunther’s forge provides!',
        markupRatio: 1.3,
        markdownRatio: 0.5,
        initialInventory: [
          makeShopItem('broadsword', 'gunther-broadsword-1'),
          makeShopItem('mammut_bone_cudgel', 'gunther-cudgel-1'),
          makeShopItem('rime_bit_chisel', 'gunther-chisel-1'),
          makeShopItem('cinder_edge_shortsword', 'gunther-sword-1'),
          makeShopItem('forge_tongue_hammer', 'gunther-hammer-1'),
          makeShopItem('lashed_driftwood_buckler', 'gunther-buckler-1'),
          makeShopItem('bellows_plate_shield', 'gunther-shield-1'),
          makeShopItem('layered_fur_jerkin', 'gunther-jerkin-1'),
          makeShopItem('mammut_hide_brigandine', 'gunther-brigandine-1'),
          makeShopItem('cinder_quenched_hauberk', 'gunther-hauberk-1'),
          makeShopItem('skraeling_bone_circlet', 'gunther-circlet-1'),
          makeShopItem('soot_visored_helm', 'gunther-helm-1'),
          makeShopItem('crampon_nailed_boots', 'gunther-boots-1'),
          makeShopItem('duergar_forge_gauntlets', 'gunther-gauntlets-1'),
          makeShopItem('cinder_edge_shortsword', 'gunther-hero-blade', { type: 'minFaction', faction: 'townsfolk', value: 25 }),
          makeShopItem('cinder_quenched_hauberk', 'gunther-hero-armor', { type: 'minFaction', faction: 'townsfolk', value: 25 }),
        ],
      },
    },
    {
      id: 'npc-astrid',
      name: 'Astrid the Alchemist',
      role: 'merchant',
      shopId: 'merchant-astrid',
      position: { x: 9, y: 27 },
      greeting: 'Potions and enchanted scrolls to ward off the dark...',
      dialogText: 'Brewing against frost and venom is an art. Drink deeply before battle.',
      merchantConfig: {
        id: 'merchant-astrid',
        name: "Astrid's Alchemy",
        greeting: 'Potions and enchanted scrolls to ward off the dark...',
        markupRatio: 1.35,
        markdownRatio: 0.45,
        initialInventory: [
          makeShopItem('hearth_broth_flask', 'astrid-broth-1'),
          makeShopItem('hearth_broth_flask', 'astrid-broth-2'),
          makeShopItem('birch_tar_poultice', 'astrid-poultice-1'),
          makeShopItem('birch_tar_poultice', 'astrid-poultice-2'),
          makeShopItem('bog_myrtle_tonic', 'astrid-tonic-1'),
          makeShopItem('bog_myrtle_tonic', 'astrid-tonic-2'),
          makeShopItem('bog_iron_whetstone', 'astrid-whetstone-1'),
          makeShopItem('bellows_skin_canteen', 'astrid-canteen-1'),
          makeShopItem('ice_stave_rune_tablet', 'astrid-tablet-1'),
          makeShopItem('rune_scratched_bark_map', 'astrid-map-1'),
          makeShopItem('scroll_phase_door', 'astrid-tele-1'),
          makeShopItem('scroll_identify', 'astrid-id-1'),
          makeShopItem('scroll_identify', 'astrid-id-2'),
          makeShopItem('wand_lightning', 'astrid-wand-1'),
          // Vendor unlock: appears only once the hero's exploration renown reaches 25
          // (Milestone Renown Ledger, docs/architecture/content-progression-scaling.md).
          makeShopItem('charm_watchful_eye', 'astrid-charm-watchful-eye', { type: 'minCounter', counter: 'renown:exploration', value: 25 }),
        ],
      },
    },
    {
      id: 'npc-priest',
      name: 'Father Torvald',
      role: 'priest',
      position: { x: 28, y: 30 },
      greeting: 'Welcome to the sacred Hall of Thor, the Thunderer.',
      dialogText: "For a humble donation of gold, Thor's lightning will shatter any curse binding your equipment, or heal all your afflictions.",
    },
    {
      id: 'npc-sage',
      name: 'Sage Mimir',
      role: 'sage',
      position: { x: 42, y: 25 },
      greeting: 'Greetings, young hero. The ancient runes hold no secrets from me.',
      dialogText: 'Bring me mysterious items from the dungeon. For a small fee, I shall unveil their true power and runic enchantments.',
    },
    {
      id: 'npc-banker',
      name: 'Banker Haakon',
      role: 'banker',
      position: { x: 47, y: 25 },
      greeting: 'Welcome to the First Bank of Bjarnarhaven.',
      dialogText: 'Carrying thousands of copper coins will crush your back! Let me exchange your heavy copper and silver into lightweight gold and platinum.',
    },
    {
      id: 'npc-guard',
      name: 'Bjorn the Town Guard',
      role: 'guard',
      position: { x: 26, y: 14 },
      greeting: 'Halt! Keep your weapons sheathed in Bjarnarhaven, adventurer.',
      dialogText: 'The dungeon cellar to the north-east leads into the depths. Many go down; few return.',
    },
    {
      id: 'npc-trainer',
      name: 'Ranvild the Hound-Warden',
      role: 'trainer',
      position: { x: 19, y: 19 },
      greeting: 'A warrior alone is a warrior half-armed. Let me bond you with a loyal companion.',
      dialogText: 'For a price I can bond you with a battle-hound, revive one that has fallen, retrain its instincts, or teach it new tricks.',
    },
    {
      // Rune of Return attunement trigger (docs/architecture/content-rune-of-return.md, engine's
      // `manifest.runeOfReturn.attunementNpcId`). The mechanism is engine-owned and
      // fixed; only this NPC's placement, name, and flavor are pack-provided.
      id: 'npc-rune-smith',
      name: 'Thrain the Rune-Smith',
      role: 'villager',
      position: { x: 45, y: 7 },
      greeting: "Bring your Rune of Return to my forge and I'll strike its charges anew — free, and quick as the hammer falls.",
      dialogText: 'Every charge spent walking these halls is a charge I can restore. Just say the word.',
    },
  ],
  services: {
    templeName: 'Temple of Thor',
    priestTitle: 'The High Priest of Thor',
    cleanseMessageTemplate: "Thor's divine lightning shatters the foul bindings on: {items}! The items are now safely stored in your pack.",
    noCursesMessage: 'The High Priest of Thor senses no foul curses binding your body.',
    donationRequiredTemplate: 'A donation of {cost} is required to call upon Thor\'s cleansing thunder. You have {funds}.',
    healMessageTemplate: 'The Priest of Thor bathes you in golden light! All afflictions are cured, and your HP and Mana are fully restored!',
    sageName: 'Sage Mimir',
    sageTitle: 'Sage Mimir',
    bankName: 'First Bank of Bjarnarhaven',
    bankerTitle: 'Banker Haakon',
    compactionMessageTemplate: 'Banker Haakon exchanged your currency into {coins}! Carry weight reduced by {savedWeight}g (from {oldWeight}g to {newWeight}g).',
    templeRefusalMessage:
      "The High Priest of Thor scowls with righteous fury: 'Desecrator of sacred altars! You have betrayed the gods and are unwelcome in Thor's sacred hall!'",
    // Blood-magic corruption: doubled donations from 25, refused outright from 75.
    corruptionSurchargeThreshold: 25,
    corruptionRefusalThreshold: 75,
  },
};

export function createOlafGeneralStore(): Merchant {
  const npc = COTW_TOWN.npcs.find((n) => n.id === 'npc-olaf')!;
  const cfg = npc.merchantConfig!;
  return new Merchant(cfg.id, cfg.name, cfg.name, 'general', cfg.greeting, [...cfg.initialInventory]);
}

export function createGuntherArmory(): Merchant {
  const npc = COTW_TOWN.npcs.find((n) => n.id === 'npc-gunther')!;
  const cfg = npc.merchantConfig!;
  return new Merchant(cfg.id, cfg.name, cfg.name, 'armory', cfg.greeting, [...cfg.initialInventory]);
}

