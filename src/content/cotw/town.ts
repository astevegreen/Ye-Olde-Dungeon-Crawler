import {
  ItemFactory,
  Merchant,
  createScaledItem,
} from '../../engine';
import type { TownLayoutDefinition } from '../../engine';
import { COTW_CATALOG_RECORD } from './items';

function makeItem(itemId: string, instanceId: string, predicate?: import('../../engine').Predicate) {
  const def = COTW_CATALOG_RECORD[itemId];
  if (!def) {
    throw new Error(`Item definition not found in COTW_CATALOG_RECORD: ${itemId}`);
  }
  const itemDef = predicate ? { ...def, predicate } : def;
  return createScaledItem(itemDef, instanceId, 1, () => 0.5);
}

export const COTW_TOWN: TownLayoutDefinition = {
  name: 'Bjarnarhaven',
  width: 50,
  height: 30,
  playerSpawn: { x: 10, y: 14 },
  stairsDown: { x: 25, y: 8 },
  buildings: [
    // Olaf's General Store (North-West)
    {
      name: "Olaf's General Store",
      buildingType: 'shop',
      bounds: { x1: 3, y1: 2, x2: 16, y2: 9 },
      door: { x: 10, y: 9, isOpen: false },
    },
    // Gunther's Armory (North-East)
    {
      name: "Gunther's Armory",
      buildingType: 'smithy',
      bounds: { x1: 33, y1: 2, x2: 46, y2: 9 },
      door: { x: 40, y: 9, isOpen: false },
    },
    // Astrid's Alchemical Herbs (South-West)
    {
      name: "Astrid's Alchemy",
      buildingType: 'shop',
      bounds: { x1: 3, y1: 19, x2: 16, y2: 27 },
      door: { x: 10, y: 19, isOpen: false },
    },
    // Father Torvald's Temple of Thor (South-Center)
    {
      name: 'Temple of Thor',
      buildingType: 'temple',
      bounds: { x1: 20, y1: 19, x2: 30, y2: 28 },
      door: { x: 25, y: 19, isOpen: true },
    },
    // Sage's Study & Bank of Bjarnarhaven (South-East)
    {
      name: "Sage Study & Vault",
      buildingType: 'bank',
      bounds: { x1: 33, y1: 19, x2: 46, y2: 27 },
      door: { x: 40, y: 19, isOpen: false },
    },
  ],
  npcs: [
    {
      id: 'npc-olaf',
      name: 'Olaf the Chandler',
      role: 'merchant',
      shopId: 'merchant-olaf',
      position: { x: 10, y: 5 },
      greeting: 'Welcome to Olaf’s General Goods! Torches, packs, and bread for hearty souls!',
      dialogText: 'Stock up on torches and rations, traveler. The depths do not forgive an empty pack.',
      merchantConfig: {
        id: 'merchant-olaf',
        name: "Olaf's General Store",
        greeting: 'Welcome to Olaf’s General Goods! Torches, packs, and bread for hearty souls!',
        markupRatio: 1.25,
        markdownRatio: 0.5,
        initialInventory: [
          ItemFactory.createTorch('olaf-torch-1'),
          ItemFactory.createTorch('olaf-torch-2'),
          ItemFactory.createTravelBread('olaf-bread-1'),
          ItemFactory.createTravelBread('olaf-bread-2'),
          ItemFactory.createLockpicks('olaf-picks-1'),
          makeItem('sealskin_rucksack', 'olaf-pack-1'),
          makeItem('leather_coin_pouch', 'olaf-purse-1'),
          makeItem('braided_sinew_cord', 'olaf-belt-1'),
          makeItem('tattered_travelers_wrap', 'olaf-wrap-1'),
          makeItem('bound_hide_wrappings', 'olaf-boots-1'),
          makeItem('hearth_broth_flask', 'olaf-broth-1'),
          makeItem('birch_tar_poultice', 'olaf-poultice-1'),
          makeItem('sealskin_rucksack', 'olaf-hero-rucksack', { type: 'minFaction', faction: 'townsfolk', value: 25 }),
        ],
      },
    },
    {
      id: 'npc-gunther',
      name: 'Gunther the Smith',
      role: 'merchant',
      shopId: 'merchant-gunther',
      position: { x: 40, y: 5 },
      greeting: 'Need cold steel or sturdy plate? Gunther’s forge provides!',
      dialogText: 'Mind your guard down there. Those hill giants strike hard enough to splinter oak.',
      merchantConfig: {
        id: 'merchant-gunther',
        name: "Gunther's Armory",
        greeting: 'Need cold steel or sturdy plate? Gunther’s forge provides!',
        markupRatio: 1.3,
        markdownRatio: 0.5,
        initialInventory: [
          ItemFactory.createBroadsword('gunther-broadsword-1'),
          makeItem('mammut_bone_cudgel', 'gunther-cudgel-1'),
          makeItem('rime_bit_chisel', 'gunther-chisel-1'),
          makeItem('cinder_edge_shortsword', 'gunther-sword-1'),
          makeItem('forge_tongue_hammer', 'gunther-hammer-1'),
          makeItem('lashed_driftwood_buckler', 'gunther-buckler-1'),
          makeItem('bellows_plate_shield', 'gunther-shield-1'),
          makeItem('layered_fur_jerkin', 'gunther-jerkin-1'),
          makeItem('mammut_hide_brigandine', 'gunther-brigandine-1'),
          makeItem('cinder_quenched_hauberk', 'gunther-hauberk-1'),
          makeItem('skraeling_bone_circlet', 'gunther-circlet-1'),
          makeItem('soot_visored_helm', 'gunther-helm-1'),
          makeItem('crampon_nailed_boots', 'gunther-boots-1'),
          makeItem('duergar_forge_gauntlets', 'gunther-gauntlets-1'),
          makeItem('cinder_edge_shortsword', 'gunther-hero-blade', { type: 'minFaction', faction: 'townsfolk', value: 25 }),
          makeItem('cinder_quenched_hauberk', 'gunther-hero-armor', { type: 'minFaction', faction: 'townsfolk', value: 25 }),
        ],
      },
    },
    {
      id: 'npc-astrid',
      name: 'Astrid the Alchemist',
      role: 'merchant',
      shopId: 'merchant-astrid',
      position: { x: 10, y: 23 },
      greeting: 'Potions and enchanted scrolls to ward off the dark...',
      dialogText: 'Brewing against frost and venom is an art. Drink deeply before battle.',
      merchantConfig: {
        id: 'merchant-astrid',
        name: "Astrid's Alchemy",
        greeting: 'Potions and enchanted scrolls to ward off the dark...',
        markupRatio: 1.35,
        markdownRatio: 0.45,
        initialInventory: [
          makeItem('hearth_broth_flask', 'astrid-broth-1'),
          makeItem('hearth_broth_flask', 'astrid-broth-2'),
          makeItem('birch_tar_poultice', 'astrid-poultice-1'),
          makeItem('birch_tar_poultice', 'astrid-poultice-2'),
          makeItem('bog_myrtle_tonic', 'astrid-tonic-1'),
          makeItem('bog_myrtle_tonic', 'astrid-tonic-2'),
          makeItem('bog_iron_whetstone', 'astrid-whetstone-1'),
          makeItem('bellows_skin_canteen', 'astrid-canteen-1'),
          makeItem('ice_stave_rune_tablet', 'astrid-tablet-1'),
          makeItem('rune_scratched_bark_map', 'astrid-map-1'),
          ItemFactory.createScrollOfTeleport('astrid-tele-1'),
          ItemFactory.createScrollOfIdentify('astrid-id-1'),
          ItemFactory.createWandOfLightning('astrid-wand-1'),
          // Vendor unlock: appears only once the hero's exploration renown reaches 25
          // (Milestone Renown Ledger, ARCHITECTURE.md P-23).
          ItemFactory.createRenownCharm({
            id: 'astrid-charm-watchful-eye',
            name: 'Charm of the Watchful Eye',
            description:
              "Astrid sets this aside only for adventurers whose reputation for uncovering the dungeon's secrets precedes them.",
            stats: { defenseBonus: 2 },
            predicate: { type: 'minCounter', counter: 'renown:exploration', value: 25 },
          }),
        ],
      },
    },
    {
      id: 'npc-priest',
      name: 'Father Torvald',
      role: 'priest',
      position: { x: 25, y: 23 },
      greeting: 'Welcome to the sacred Hall of Thor, the Thunderer.',
      dialogText: "For a humble donation of gold, Thor's lightning will shatter any curse binding your equipment, or heal all your afflictions.",
    },
    {
      id: 'npc-sage',
      name: 'Sage Mimir',
      role: 'sage',
      position: { x: 36, y: 23 },
      greeting: 'Greetings, young hero. The ancient runes hold no secrets from me.',
      dialogText: 'Bring me mysterious items from the dungeon. For a small fee, I shall unveil their true power and runic enchantments.',
    },
    {
      id: 'npc-banker',
      name: 'Banker Haakon',
      role: 'banker',
      position: { x: 43, y: 23 },
      greeting: 'Welcome to the First Bank of Bjarnarhaven.',
      dialogText: 'Carrying thousands of copper coins will crush your back! Let me exchange your heavy copper and silver into lightweight gold and platinum.',
    },
    {
      id: 'npc-guard',
      name: 'Bjorn the Town Guard',
      role: 'guard',
      position: { x: 25, y: 15 },
      greeting: 'Halt! Keep your weapons sheathed in Bjarnarhaven, adventurer.',
      dialogText: 'The dungeon cellar to the north-east leads into the depths. Many go down; few return.',
    },
    {
      id: 'npc-trainer',
      name: 'Ranvild the Hound-Warden',
      role: 'trainer',
      position: { x: 30, y: 15 },
      greeting: 'A warrior alone is a warrior half-armed. Let me bond you with a loyal companion.',
      dialogText: 'For a price I can bond you with a battle-hound, revive one that has fallen, retrain its instincts, or teach it new tricks.',
    },
    {
      // Rune of Return attunement trigger (ARCHITECTURE.md P-03 stage 3, engine's
      // `manifest.runeOfReturn.attunementNpcId`). The mechanism is engine-owned and
      // fixed; only this NPC's placement, name, and flavor are pack-provided.
      id: 'npc-rune-smith',
      name: 'Thrain the Rune-Smith',
      role: 'villager',
      position: { x: 40, y: 7 },
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

