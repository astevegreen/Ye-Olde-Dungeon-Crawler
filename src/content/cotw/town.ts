import { Merchant } from '../../engine';
import type { TownLayoutDefinition } from '../../engine';
import { makeShopItem } from './items/makeItem';
import { COTW_TABLET_STOCK } from './spellTablets';
import { TOWN_ROWS, TOWN_LEGEND, TOWN_WIDTH, TOWN_HEIGHT, TOWN_BUILDINGS, TOWN_PLAYER_SPAWN, TOWN_STAIRS_DOWN } from './townLayout';
import { IVALDA_MASTERWORK } from './ironClans';

export const COTW_TOWN: TownLayoutDefinition = {
  name: 'Bjarnarhaven',
  // A clearing in the pine woods (townLayout.ts): lanes wind between the buildings to a
  // plaza with a frozen fountain.
  width: TOWN_WIDTH,
  height: TOWN_HEIGHT,
  layout: TOWN_ROWS,
  legend: TOWN_LEGEND,
  // A village by day: the lanes and plaza are seen as far as the eye reaches, not by torch.
  lit: true,
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
      greeting: 'Welcome to Olaf’s General Goods! Broth, poultices, torches, and a warm wrap for hearty souls!',
      dialogText: 'Stock up on broth and poultices, traveler. And if your purse is bursting, I sell bigger ones.',
      merchantConfig: {
        id: 'merchant-olaf',
        name: "Olaf's General Store",
        greeting: 'Welcome to Olaf’s General Goods! Broth, poultices, torches, and a warm wrap for hearty souls!',
        markupRatio: 1.25,
        markdownRatio: 0.5,
        initialInventory: [
          makeShopItem('tattered_travelers_wrap', 'olaf-wrap-1'),
          makeShopItem('hearth_broth_flask', 'olaf-broth-1'),
          makeShopItem('birch_tar_poultice', 'olaf-poultice-1'),
          // Bigger purses (Q44): the coins in the old one move into the new one.
          makeShopItem('wooden_torch', 'olaf-torch-1'),
          makeShopItem('wooden_torch', 'olaf-torch-2'),
          makeShopItem('ironclasp_purse', 'olaf-purse-1'),
          makeShopItem('quicksilver_lined_purse', 'olaf-purse-2'),
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
          makeShopItem('rime_bit_chisel', 'gunther-chisel-1'),
          makeShopItem('cinder_edge_shortsword', 'gunther-sword-1'),
          makeShopItem('forge_tongue_hammer', 'gunther-hammer-1'),
          makeShopItem('lashed_driftwood_buckler', 'gunther-buckler-1'),
          makeShopItem('bellows_plate_shield', 'gunther-shield-1'),
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
          makeShopItem('bellows_skin_canteen', 'astrid-canteen-1'),
          makeShopItem('scroll_phase_door', 'astrid-tele-1'),
          makeShopItem('scroll_identify', 'astrid-id-1'),
          makeShopItem('scroll_identify', 'astrid-id-2'),
          makeShopItem('wand_lightning', 'astrid-wand-1'),
          // Vendor unlock: appears only once the hero's exploration renown reaches 25
          // (Milestone Renown Ledger, docs/architecture/content-progression-scaling.md).
          makeShopItem('charm_watchful_eye', 'astrid-charm-watchful-eye', { type: 'minCounter', counter: 'renown:exploration', value: 25 }),
          // Catch-up rune tablets, each unlocked once the hero is past the zone that teaches it (spellTablets.ts)
          ...COTW_TABLET_STOCK.map((t) => makeShopItem(t.itemId, `astrid-${t.itemId}`, t.predicate)),
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
      dialogText: 'Bring me mysterious items from the dungeon. For a small fee, I shall unveil their true power and runic enchantments. And if you would bargain with the deep, swear your pacts here, as the Allfather once pledged at my well.',
    },
    {
      id: 'npc-banker',
      name: 'Banker Haakon',
      role: 'banker',
      position: { x: 47, y: 25 },
      greeting: 'Welcome to the First Bank of Bjarnarhaven.',
      dialogText: 'A purse stuffed with copper has no room left for silver. Let me exchange your copper and silver for gold of the same worth, and your purse will hold far more. No fee.',
    },
    {
      id: 'npc-guard',
      name: 'Bjorn the Town Guard',
      role: 'guard',
      position: { x: 26, y: 14 },
      greeting: 'Halt! Keep your weapons sheathed in Bjarnarhaven, adventurer.',
      dialogText: 'The dungeon cellar to the north-east leads into the depths. Many go down; few return.',
      advice: 'Bjarnarhaven is peaceful, but the cellar entrance north-east holds terrors from old myths. Buy sturdy armor and healing draughts before you venture down, and a torch from Olaf: past the fire-rift, they say, something drinks the light.',
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
    cleanseMessageTemplate: "Thor's divine lightning shatters the foul bindings on: {items}!",
    noCursesMessage: 'The High Priest of Thor senses no foul curses binding your body.',
    donationRequiredTemplate: 'A donation of {cost} is required to call upon Thor\'s cleansing thunder. You have {funds}.',
    healMessageTemplate: 'The Priest of Thor bathes you in golden light! All afflictions are cured, and your HP and Seiðr are fully restored!',
    sageName: 'Sage Mimir',
    sageTitle: 'Sage Mimir',
    bankName: 'First Bank of Bjarnarhaven',
    bankerTitle: 'Banker Haakon',
    compactionMessageTemplate: 'Banker Haakon exchanged your {oldCount} coins for {newCount}, worth the same {coins}.',
    templeRefusalMessage:
      "The High Priest of Thor scowls with righteous fury: 'Desecrator of sacred altars! You have betrayed the gods and are unwelcome in Thor's sacred hall!'",
    templeShunnedMessage:
      "The High Priest of Thor recoils from what you wear: 'Hel's mark is on you. I will burn it from you for twice the donation, and lay no other hand on you until then.'",
    // Blood-magic corruption: doubled donations from 25, refused outright from 75 (all but
    // the cleanse, which is never refused: Q50).
    corruptionSurchargeThreshold: 25,
    corruptionRefusalThreshold: 75,
    // Q9 "A", Q49 "A", Q50 "A": cursed, hexed and Hel-touched things from the pack, for
    // piety (5 each) and a step back toward the temple's favor; three blessings, once each.
    pietyCategory: 'piety',
    templeOfferings: {
      alignments: ['negative'],
      milestoneId: 'temple_offering',
      standingDelta: 1,
      messageTemplate: 'The High Priest of Thor takes {item} from you and casts it into the sacred fire. The gods mark the gift.',
    },
    // Q11 "A" + Q60 "A": Mimir sells Study (one bestiary rank) and Rumors (an unmet creature),
    // priced by the creature's home floor: Study 60 CP on floor 1 to 540 on 49, Rumors 550 to 2,950.
    monsterLore: {
      study: { baseCp: 50, perFloorCp: 10 },
      rumor: { baseCp: 500, perFloorCp: 50 },
    },
    // Q10 "A" + Q47 "A": Gunther raises +N a step at a time to +3 (250, 750, 2,000 CP); Ivalda's
    // +5 is on his Forge list once she works beside him (Q29, Q48 "A").
    smiths: [
      {
        npcId: 'npc-gunther',
        categories: ['weapon', 'armor', 'shield', 'helmet', 'boots'],
        stepPricesCp: [250, 750, 2000],
        messageTemplate: 'Gunther heats the steel and hammers it true on his anvil: {item}.',
        masterwork: IVALDA_MASTERWORK,
      },
    ],
    templeBlessings: [
      {
        id: 'eirs_mercy',
        name: "Eir's Mercy",
        description: 'Eir, healer of the gods, keeps you: the temple heals you without a donation from now on.',
        minPiety: 30,
        effect: { type: 'freeHealing' },
        message: 'The High Priest of Thor calls on Eir, healer of the gods. From now on the temple heals you without a donation.',
      },
      {
        id: 'thors_hallowing',
        name: "Thor's Hallowing",
        description: 'The priest hallows one plain weapon or armor piece you carry: it becomes Holy, bane of the undead and demons, as strong as your deepest floor allows.',
        minPiety: 60,
        effect: { type: 'hallowItem', family: 'holy', categories: ['weapon', 'armor', 'shield', 'helmet', 'boots', 'gauntlets', 'bracers', 'cloak'] },
        message: "The High Priest of Thor lays the hammer-sign on your gear. Thor's light settles in it: {item}.",
      },
      {
        id: 'baldrs_grace',
        name: "Baldr's Grace",
        description: "Baldr's light settles in you: your max HP rises by a tenth, for good.",
        minPiety: 100,
        effect: { type: 'maxHpPercent', percent: 0.1 },
        message: "The High Priest of Thor speaks Baldr's name over you, and warmth runs through your veins (+10% max HP, for good).",
      },
    ],
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

