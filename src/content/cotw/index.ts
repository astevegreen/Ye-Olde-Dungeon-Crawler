import type { GameContentManifest, AttributeMilestoneTrigger } from '../../engine';
import { COTW_MONSTERS, COTW_BESTIARY } from './monsters';
import { COTW_ITEMS } from './items';
import { COTW_SPELLS } from './spells';
import { COTW_TOWN } from './town';
import { COTW_QUEST } from './quest';
import { COTW_ATLAS_THEME } from './atlas';
import { COTW_STARTER_KIT } from './character';
import { COTW_AFFINITY_MATRIX } from './elements';
import { COTW_EQUIPMENT_SLOTS } from './slots';
import { COTW_THEME_TOKENS } from './theme';
import { COTW_VAULTS } from './vaults';
import { COTW_SPRITE_RECIPES } from './sprites';
import { COTW_CHOICES } from './choices';
import { COTW_PACTS } from './pacts';
import { COTW_RENOWN_MILESTONES, COTW_RENOWN_TITLES } from './renown';
import { COTW_COMPANIONS } from './companions';
import { GIANT_BLOOD_STATUS, giantBloodHandler, GIANT_BLOOD_BOOTSTRAP_HOOK } from './giantBlood';
import { COTW_MONSTER_SCALING } from './monsterScaling';
import { OATH_TRIGGER, OATH_TIMED_EVENT } from './oath';
import { HOSTAGE_VILLAGERS, SIPHON_RITUAL_FLOOR, SIPHON_RITUAL_HOOKS, SIPHON_TIMED_EVENT, SIPHON_VAULT_ID } from './hostageRitual';
import { COTW_BLOOD_SPELLS } from './bloodMagic';
import { COTW_TILES } from './tiles';
import { COTW_FLOOR_HAZARDS, COTW_ROOM_DECORATION } from './floorBands';
import { COTW_FLOOR_LAYOUTS, COTW_FLOOR_SIZE } from './floorLayouts';

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
    victoryBanner: 'The Sun-Stone of Freyr is restored to Bjarnarhaven!',
    fallenBanner: 'Your soul departs Midgard for the eternal halls of Valhalla.',
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
  pacts: COTW_PACTS,
  traps: [
    { type: 'pit', name: 'Hidden Pit', damage: 10, disarmDifficulty: 12 },
    { type: 'arrow', name: 'Tripwire Dart Trap', damage: 8, disarmDifficulty: 14 },
    { type: 'teleport', name: 'Teleportation Rune', damage: 0, disarmDifficulty: 15 },
    { type: 'alarm', name: 'Brass Alarm Trap', damage: 0, disarmDifficulty: 10 },
  ],
  flankLayout: {
    left: ['world_ledger'],
    right: ['auto_journal'],
    theme: 'parchment',
  },
  trackedMilestones: [
    { flag: 'relic_recovered', label: 'Sun-Stone Claimed', description: 'Recovered the Sun-Stone of Freyr from the dungeon depths.', icon: '☀️' },
    { flag: 'boss_slain', label: 'Hrungnir Slain', description: 'Vanquished the Frost Giant Overlord in epic combat.', icon: '👑' },
    { flag: 'altar_cleansed', label: 'Altar of Tyr Cleansed', description: 'Purified the corrupted altar with solemn sacrifice.', icon: '⚖️' },
    { flag: 'oath_resolved', label: "The Matriarch's Blood-Oath", description: 'Struck a lasting bargain with a troll-wife matriarch to sever the siphon on the village.', icon: '🩸' },
    { flag: 'nidhogg_root_sealed', label: 'The Root Sealed', description: 'Drove Níðhögg from the rotting root of Yggdrasil without ending it.', icon: '🌳' },
    { flag: 'savior_of_jarnvidr', label: 'Savior of Járnviðr', description: 'Rescued all four captive villagers from the sacrificial blood siphon.', icon: '🛡️' },
    { flag: 'blood_tainted_hero', label: 'The Blood-Tainted', description: 'Embraced the forbidden Grimoire of Blood Magic while innocent captives bled.', icon: '🩸' },
  ],
  renownMilestones: COTW_RENOWN_MILESTONES,
  renownTitles: COTW_RENOWN_TITLES,
  companions: COTW_COMPANIONS,
  monsterScaling: COTW_MONSTER_SCALING,
  actionHooks: [GIANT_BLOOD_BOOTSTRAP_HOOK, ...SIPHON_RITUAL_HOOKS],
  storyChoiceTriggers: [OATH_TRIGGER],
  attributeMilestones: COTW_ATTRIBUTE_MILESTONES,
  timedEvents: [OATH_TIMED_EVENT, SIPHON_TIMED_EVENT],
  bossFleeResolutions: [
    { monsterDefinitionId: 'nidhogg', fleeTurnsRequired: 5, sealedFlag: 'nidhogg_root_sealed' },
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
  ],
  statusHandlers: {
    [GIANT_BLOOD_STATUS]: giantBloodHandler,
  },
  fixedTilePlacements: [
    {
      floor: 3,
      tileId: 'altar_tyr',
      placement: 'middle_room_center',
      requiresChoiceId: 'altar_tyr',
    },
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
  },
  scriptedVaultPlacements: [
    {
      floor: SIPHON_RITUAL_FLOOR,
      vaultId: SIPHON_VAULT_ID,
      npcs: HOSTAGE_VILLAGERS,
    },
    // Víðnir and the shed fang: guaranteed on floor 45, not a chance draw from the vault pool.
    { floor: 45, vaultId: 'floor45_fang_vault' },
  ],
  // Townsfolk standing moves shop prices (hostage ritual outcome, story choices).
  roomDecoration: COTW_ROOM_DECORATION,
  floorHazards: COTW_FLOOR_HAZARDS,
  floorLayouts: COTW_FLOOR_LAYOUTS,
  floorSize: COTW_FLOOR_SIZE,
  merchantPricing: {
    faction: 'townsfolk',
    tiers: [
      { minStanding: 30, multiplier: 0.75 },
      { minStanding: 20, multiplier: 0.9 },
      { maxStanding: -20, multiplier: 1.3 },
      { maxStanding: -10, multiplier: 1.15 },
    ],
  },
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
};
