import type { GameContentManifest, AttributeMilestoneTrigger } from '../../engine';
import { COTW_MONSTERS, COTW_BESTIARY } from './monsters';
import { COTW_ITEMS } from './items';
import { COTW_SPELLS } from './spells';
import { COTW_TOWN } from './town';
import { COTW_QUEST } from './quest';
import { COTW_ATLAS_THEME } from './atlas';
import { COTW_STARTER_KIT } from './character';
import { COTW_MAGIC } from './magic';
import { COTW_DEEPEST_FLOOR_COUNTER, DEEPEST_FLOOR_HOOK } from './spellTablets';
import { COTW_AFFINITY_MATRIX } from './elements';
import { COTW_EQUIPMENT_SLOTS } from './slots';
import { COTW_THEME_TOKENS } from './theme';
import {
  COTW_VAULTS,
  DWARVEN_HEARTH_FLOOR,
  DWARVEN_HEARTH_VAULT_ID,
  CHARIOT_FORGE_VAULT_ID,
  BILE_SUMP_VAULT_ID,
  MARROW_OSSUARY_VAULT_ID,
  CHARIOT_FORGE_FLOOR,
  WORLD_BARK_FLOOR,
  WORLD_BARK_VAULT_ID,
} from './vaults';
import { COTW_SPRITE_RECIPES } from './sprites';
import { COTW_CHOICES } from './choices';
import { COTW_PACTS } from './pacts';
import { COTW_RENOWN_MILESTONES, COTW_RENOWN_TITLES } from './renown';
import { COTW_OBJECTIVES } from './objectives';
import { COTW_COMPANIONS } from './companions';
import { GIANT_BLOOD_STATUS, giantBloodHandler, GIANT_BLOOD_BOOTSTRAP_HOOK } from './giantBlood';
import { BURNING_STATUS, burningHandler } from './burning';
import { COTW_MONSTER_SCALING } from './monsterScaling';
import { OATH_HOLD_HOOK, OATH_TRIGGER } from './oath';
import { HOSTAGE_VILLAGERS, SIPHON_RITUAL_FLOOR, SIPHON_RITUAL_HOOKS, SIPHON_TIMED_EVENT, SIPHON_VAULT_ID } from './hostageRitual';
import { COTW_PROLOGUE, COVEN_CHANNELER_STRATEGY, PROLOGUE_HOOKS, PROLOGUE_TIMED_EVENT } from './prologue';
import { COTW_BLOOD_SPELLS } from './bloodMagic';
import { COTW_TILES } from './tiles';
import { COTW_FLOOR_HAZARDS, COTW_ROOM_DECORATION } from './floorBands';
import { COTW_FLOOR_LAYOUTS, COTW_FLOOR_SIZE } from './floorLayouts';
import { COTW_MONSTER_CATEGORIES } from './monsterCategories';
import { COTW_FACTIONS, COTW_MERCHANT_PRICING, COTW_TEMPLE_MET_HOOK } from './factions';
import { COTW_FIRST_TIME_HINTS } from './hints';
import { COTW_RELIC_HOOK } from './relic';
import { IRON_CLANS_BARROW_PLACEMENTS, IRON_CLANS_HOOKS, IVALDA } from './ironClans';
import { SKALDIC_RUNESTONE_LORE, SKALDIC_RUNESTONE_PLACEMENTS } from './runestones';
import {
  VIDNIR_DEFEATED_TRIGGER,
  COTW_ZONE_VIGNETTES_HOOK,
  COTW_SVART_TAUNT_HOOK,
  COTW_TOWN_REACTIVE_HOOK,
} from './narrative';

export const COTW_ATTRIBUTE_MILESTONES: AttributeMilestoneTrigger[] = [
  { id: 'milestone_dex_15', attribute: 'dexterity', threshold: 15, choiceId: 'milestone_dex_15' },
  { id: 'milestone_str_15', attribute: 'strength', threshold: 15, choiceId: 'milestone_str_15' },
  { id: 'milestone_con_15', attribute: 'constitution', threshold: 15, choiceId: 'milestone_con_15' },
  { id: 'milestone_int_15', attribute: 'intelligence', threshold: 15, choiceId: 'milestone_int_15' },
];

export const cotwManifest: GameContentManifest = {
  id: 'cotw',
  name: 'Castle of the Winds',
  description: 'Classic Norse-themed roguelike fantasy adventure in Midgard.',
  branding: {
    hallOfFameName: 'Hall of Valhalla',
    hallOfFameShortName: 'Valhalla',
    worldName: 'Midgard',
    victoryTitle: 'Victory in Midgard!',
    victoryBanner: 'The Hearth-Tear is home, and the root is answered!',
    fallenBanner: 'Your soul departs Midgard for the eternal halls of Valhalla.',
    xpName: 'Megin',
    // Seiðr: the Norse practice of magic, the spell resource under the blue orb.
    manaName: 'Seiðr',
    healthGlyph: 'ᚦ',
    manaGlyph: 'ᚨ',
    ornament: 'ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ',
    loreTitle: 'Carved Verses',
    loreVerseLabel: 'Saga',
    loreNoteLabel: 'Rune-lore',
  },
  tiles: COTW_TILES,
  monsters: COTW_MONSTERS,
  items: COTW_ITEMS,
  spells: COTW_SPELLS,
  town: COTW_TOWN,
  quest: COTW_QUEST,
  atlas: COTW_ATLAS_THEME,
  starterKit: COTW_STARTER_KIT,
  affinityMatrix: COTW_AFFINITY_MATRIX,
  equipmentSlots: COTW_EQUIPMENT_SLOTS,
  theme: COTW_THEME_TOKENS,
  vaults: COTW_VAULTS,
  spriteRecipes: COTW_SPRITE_RECIPES,
  presetNames: ['Sven', 'Astrid', 'Bjorn', 'Freya'],
  choices: COTW_CHOICES,
  magic: COTW_MAGIC,
  pacts: COTW_PACTS,
  // Pacts are sworn with Sage Mimir, as Odin pledged an eye at Mímir's well for wisdom.
  pactKeeperNpcId: 'npc-sage',
  firstTimeHints: COTW_FIRST_TIME_HINTS,
  traps: [
    { type: 'pit', name: 'Hidden Pit', damage: 10, disarmDifficulty: 12 },
    { type: 'arrow', name: 'Tripwire Dart Trap', damage: 8, disarmDifficulty: 14 },
    { type: 'teleport', name: 'Teleportation Rune', damage: 0, disarmDifficulty: 15 },
    { type: 'alarm', name: 'Brass Alarm Trap', damage: 0, disarmDifficulty: 10 },
  ],
  // Each riddle stands in for its milestone in the Story until it is achieved.
  // Riddles: Claude's wording at the owner's request, checked against what each milestone
  // actually takes (2026-10-02). The owner may still reword any of them.
  trackedMilestones: [
    { flag: 'relic_recovered', label: 'Hearth-Tear Reclaimed', description: 'Took back the stolen shard of Sól’s sun-chariot from the Sun-Chariot Warden.', icon: '☀️', riddle: 'Where the coven forges stolen sunfire, a burning keeper holds a shard of the sun. Take it back.' },
    { flag: 'nidhogg_slain', label: 'Níðhögg Slain', description: 'Struck down Níðhögg at the root of Yggdrasil, and split the World Tree.', icon: '👑', riddle: 'At the root’s last ring the corpse-gnawer feeds. A blade can end it, if you will pay what ending costs.', riddleAfterFlag: 'vidnir_slain' },
    { flag: 'tyr_purified', label: 'Altar of Tyr Cleansed', description: 'Purified the defiled altar on Floor 3 with an oath and a solemn sacrifice.', icon: '⚖️', riddle: 'Thrice below, the oath-god’s stone stands fouled. He gave a hand; it asks a gift of yours.' },
    { flag: 'oath_resolved', label: "The Matriarch's Blood-Oath", description: 'Struck a lasting bargain with a troll-wife matriarch to sever the siphon on the village.', icon: '🩸', riddle: 'With the sun-shard won back, a troll-mother bargains in blood. Hot or cold, her price is kept forever.' },
    { flag: 'nidhogg_root_sealed', label: 'The Root Sealed', description: 'Drove Níðhögg from the rotting root of Yggdrasil without ending it.', icon: '🌳', riddle: 'Not every wyrm need die. Wound the gnawer until it turns tail, then give chase, and it may slink back to the dark.', riddleAfterFlag: 'vidnir_slain' },
    { flag: 'savior_of_jarnvidr', label: 'Savior of Járnviðr', description: 'Rescued all four captive villagers from the sacrificial blood siphon.', icon: '🛡️', riddle: 'Four of the village bleed to feed an iron wood. Reach them all before the bowl runs full.' },
    { flag: 'blood_tainted_hero', label: 'The Blood-Tainted', description: 'Embraced the forbidden Grimoire of Blood Magic while innocent captives bled.', icon: '🩸', riddle: 'A book of red letters opens only while the innocent bleed. To read it is to wear it.' },
    { flag: 'vidnir_slain', label: "The Wyrm's Fate Revealed", description: 'Learned from the dying herald Víðnir that slaying Níðhögg will split Yggdrasil and trigger Ragnarök, while driving it off will seal the root.', icon: '🐉', riddle: 'At the wyrm’s maw a herald keeps its master’s secret, and speaks it only dying.' },
    { flag: 'dwarven_hearth_rested', label: 'Dwarven Hearth Respite', description: 'Found solace in the secluded thermal grotto behind the rushing cascade.', icon: '♨️', riddle: 'Behind falling water in the smiths’ halls, old coals still keep a warm place to sleep.' },
    { flag: 'world_bark_hearth_rested', label: 'Heartwood Sanctuary', description: 'Rested in the peaceful hollow among the ancient roots of Yggdrasil.', icon: '🌳', riddle: 'Inside the world-tree’s bark an amber fire burns. Sit by it, and the roots keep watch.' },
  ],
  // The runestones' verses and rune-lore, kept in the Story's Carved Verses once read.
  loreEntries: SKALDIC_RUNESTONE_LORE,
  renownMilestones: COTW_RENOWN_MILESTONES,
  renownTitles: COTW_RENOWN_TITLES,
  objectives: COTW_OBJECTIVES,
  companions: COTW_COMPANIONS,
  monsterScaling: COTW_MONSTER_SCALING,
  actionHooks: [
    GIANT_BLOOD_BOOTSTRAP_HOOK,
    ...PROLOGUE_HOOKS,
    ...SIPHON_RITUAL_HOOKS,
    DEEPEST_FLOOR_HOOK,
    COTW_ZONE_VIGNETTES_HOOK,
    COTW_SVART_TAUNT_HOOK,
    COTW_TOWN_REACTIVE_HOOK,
    COTW_TEMPLE_MET_HOOK,
    COTW_RELIC_HOOK,
    OATH_HOLD_HOOK,
    ...IRON_CLANS_HOOKS,
  ],
  storyChoiceTriggers: [OATH_TRIGGER, VIDNIR_DEFEATED_TRIGGER],
  attributeMilestones: COTW_ATTRIBUTE_MILESTONES,
  monsterCategories: COTW_MONSTER_CATEGORIES,
  timedEvents: [PROLOGUE_TIMED_EVENT, SIPHON_TIMED_EVENT],
  // The night raid a new hero begins with (prologue.ts).
  prologue: COTW_PROLOGUE,
  aiStrategies: { [COVEN_CHANNELER_STRATEGY.id]: COVEN_CHANNELER_STRATEGY },
  bossFleeResolutions: [
    {
      monsterDefinitionId: 'nidhogg',
      fleeTurnsRequired: 5,
      sealedFlag: 'nidhogg_root_sealed',
      portalTileId: 'gateway_home',
      portalMessage: 'Where Níðhögg fled, the gnawed root knits closed and a path of light opens toward home. Step onto it to go back to Bjarnarhaven.',
    },
  ],
  initialWorldState: {
    flags: {},
    counters: {},
    factions: {
      townsfolk: 10,
      temple_standing: 0,
      iron_clans: -15,
    },
  },
  factions: COTW_FACTIONS,
  deepestFloorCounter: COTW_DEEPEST_FLOOR_COUNTER,
  statusEffects: [
    {
      id: 'poison',
      name: 'Poison',
      tickMessage: '{name} suffers periodic poison damage!',
      expireMessage: 'The poison has run its course in {name}.',
    },
    {
      id: 'paralysis',
      name: 'Paralysis',
      expireMessage: '{name} is no longer paralyzed.',
    },
    {
      id: 'slow',
      name: 'Slow',
      expireMessage: "{name}'s sluggishness fades and speed normalizes.",
    },
    {
      id: 'haste',
      name: 'Haste',
      expireMessage: "{name}'s supernatural haste subsides.",
    },
    {
      id: 'blindness',
      name: 'Blindness',
      expireMessage: "{name}'s vision returns!",
    },
    {
      id: 'stunned',
      name: 'Stunned',
      expireMessage: '{name} recovers from the stunning blow and regains composure.',
    },
    {
      id: GIANT_BLOOD_STATUS,
      name: "Giant's Blood",
      hudColor: '#38bdf8',
    },
    {
      id: BURNING_STATUS,
      name: 'Burning',
    },
  ],
  statusHandlers: {
    [GIANT_BLOOD_STATUS]: giantBloodHandler,
    [BURNING_STATUS]: burningHandler,
  },
  fixedTilePlacements: [
    {
      floor: 3,
      tileId: 'altar_tyr',
      placement: 'middle_room_center',
      requiresChoiceId: 'altar_tyr',
    },
    ...SKALDIC_RUNESTONE_PLACEMENTS,
    ...IRON_CLANS_BARROW_PLACEMENTS,
    // Runic spell altars (COTW_MAGIC.altars): one every few floors; four are Hel's, one per sealed corner
    { floor: 4, tileId: 'galdr_altar_tyr', placement: 'middle_room_center' },
    { floor: 7, tileId: 'galdr_altar_hel', placement: 'middle_room_center' },
    { floor: 11, tileId: 'galdr_altar_odin', placement: 'middle_room_center' },
    { floor: 15, tileId: 'galdr_altar_loki', placement: 'middle_room_center' },
    { floor: 19, tileId: 'galdr_altar_hel', placement: 'middle_room_center' },
    { floor: 23, tileId: 'galdr_altar_tyr', placement: 'middle_room_center' },
    { floor: 27, tileId: 'galdr_altar_odin', placement: 'middle_room_center' },
    { floor: 31, tileId: 'galdr_altar_hel', placement: 'middle_room_center' },
    { floor: 35, tileId: 'galdr_altar_loki', placement: 'middle_room_center' },
    { floor: 39, tileId: 'galdr_altar_tyr', placement: 'middle_room_center' },
    { floor: 43, tileId: 'galdr_altar_hel', placement: 'middle_room_center' },
    { floor: 47, tileId: 'galdr_altar_odin', placement: 'middle_room_center' },
  ],
  runeOfReturn: {
    attunementNpcId: 'npc-rune-smith',
    trackNames: {
      celerity: 'Channel Celerity',
      weave: 'Steadfast Weave',
      mobility: 'Unbound Casting',
    },
    acquisition: {
      floor: 5,
      vaultId: 'floor5_rune_vault',
    },
    whereaboutsHint: 'an ancient ice vault on Floor 5 guarded by Gálmr the Frost-Warden',
  },
  scriptedVaultPlacements: [
    {
      floor: SIPHON_RITUAL_FLOOR,
      vaultId: SIPHON_VAULT_ID,
      npcs: HOSTAGE_VILLAGERS,
    },
    // Svartr, the Taproot Matriarch: guaranteed on floor 36 (her fall draws Víðnir's taunt, narrative.ts).
    { floor: 36, vaultId: 'floor36_matriarch_hollow' },
    // The Sun-Chariot Warden and the Hearth-Tear: the end of Act 1, once, on floor 25.
    { floor: CHARIOT_FORGE_FLOOR, vaultId: CHARIOT_FORGE_VAULT_ID },
    // Víðnir and the shed fang: guaranteed on floor 45, not a chance draw from the vault pool.
    { floor: 45, vaultId: 'floor45_fang_vault' },
    // Gloom-Tarr in the Bile-Sump, and Sköll in the Marrow Ossuary: the Maw's other two.
    { floor: 44, vaultId: BILE_SUMP_VAULT_ID },
    { floor: 47, vaultId: MARROW_OSSUARY_VAULT_ID },
    // Act 1 Campfire Grotto: The Dwarven Hearth Grotto on floor 13
    // Ivalda, the last forge-keeper of the Iron Clans (ironClans.ts), keeps its coals.
    { floor: DWARVEN_HEARTH_FLOOR, vaultId: DWARVEN_HEARTH_VAULT_ID, npcs: [IVALDA] },
    // Act 2 Campfire Grotto: The Heartwood Knothole on floor 37
    { floor: WORLD_BARK_FLOOR, vaultId: WORLD_BARK_VAULT_ID },
  ],
  // Townsfolk standing moves shop prices (hostage ritual outcome, story choices).
  roomDecoration: COTW_ROOM_DECORATION,
  floorHazards: COTW_FLOOR_HAZARDS,
  floorLayouts: COTW_FLOOR_LAYOUTS,
  floorSize: COTW_FLOOR_SIZE,
  merchantPricing: COTW_MERCHANT_PRICING,
};

export const COTW_MANIFEST = cotwManifest;

export {
  COTW_MONSTERS,
  COTW_BESTIARY,
  COTW_ITEMS,
  COTW_SPELLS,
  COTW_BLOOD_SPELLS,
  COTW_TOWN,
  COTW_QUEST,
  COTW_ATLAS_THEME,
  COTW_STARTER_KIT,
  COTW_AFFINITY_MATRIX,
  COTW_EQUIPMENT_SLOTS,
  COTW_VAULTS,
  COTW_SPRITE_RECIPES,
  COTW_TILES,
  COTW_CHOICES,
};
