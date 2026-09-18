import type { GameContentManifest } from '../../engine';
import { COTW_MONSTERS, COTW_BESTIARY } from './monsters';
import { COTW_ITEMS } from './items';
import { COTW_SPELLS } from './spells';
import { COTW_TOWN } from './town';
import { COTW_QUEST } from './quest';
import { COTW_ATLAS_THEME } from './atlas';
import { COTW_STARTER_KIT, COTW_PROGRESSION } from './character';
import { COTW_AFFINITY_MATRIX } from './elements';
import { COTW_EQUIPMENT_SLOTS } from './slots';
import { COTW_THEME_TOKENS } from './theme';
import { COTW_VAULTS } from './vaults';
import { COTW_SPRITE_RECIPES } from './sprites';
import { COTW_CHOICES } from './choices';
import { COTW_PACTS } from './pacts';
import { COTW_RENOWN_MILESTONES, COTW_RENOWN_TITLES } from './renown';
import { COTW_COMPANIONS } from './companions';
import { JARNVIDR_EXPOSURE_STATUS, jarnvidrExposureHandler, JARNVIDR_HAZARD_BOOTSTRAP_HOOK } from './hazards';
import { OATH_TRIGGER, OATH_TIMED_EVENT } from './oath';

export const cotwManifest: GameContentManifest = {
  id: 'cotw',
  name: 'Castle of the Winds',
  description: 'Classic Norse-themed roguelike fantasy adventure in Midgard.',
  supportsLegacyKeys: true,
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
    { flag: 'winch_repaired', label: 'Mine Lift Restored', description: 'Repaired the main haulage winch to descend into the abyss.', icon: '⚙️' },
    { flag: 'boss_slain', label: 'Hrungnir Slain', description: 'Vanquished the Frost Giant Overlord in epic combat.', icon: '👑' },
    { flag: 'altar_cleansed', label: 'Altar of Tyr Cleansed', description: 'Purified the corrupted altar with solemn sacrifice.', icon: '⚖️' },
    { flag: 'oath_resolved', label: "The Matriarch's Blood-Oath", description: 'Struck a lasting bargain with a troll-wife matriarch to sever the siphon on the village.', icon: '🩸' },
    { flag: 'nidhogg_root_sealed', label: 'The Root Sealed', description: 'Drove Níðhögg from the rotting root of Yggdrasil without ending it.', icon: '🌳' },
  ],
  renownMilestones: COTW_RENOWN_MILESTONES,
  renownTitles: COTW_RENOWN_TITLES,
  companions: COTW_COMPANIONS,
  progressionConfig: COTW_PROGRESSION,
  actionHooks: [JARNVIDR_HAZARD_BOOTSTRAP_HOOK],
  storyChoiceTriggers: [OATH_TRIGGER],
  timedEvents: [OATH_TIMED_EVENT],
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
  ],
  statusHandlers: {
    [JARNVIDR_EXPOSURE_STATUS]: jarnvidrExposureHandler,
  },
  runeOfReturn: {
    attunementNpcId: 'npc-rune-smith',
    trackNames: {
      celerity: 'Channel Celerity',
      weave: 'Steadfast Weave',
      mobility: 'Unbound Casting',
    },
  },
};

export const COTW_MANIFEST = cotwManifest;

export {
  COTW_MONSTERS,
  COTW_BESTIARY,
  COTW_ITEMS,
  COTW_SPELLS,
  COTW_TOWN,
  COTW_QUEST,
  COTW_ATLAS_THEME,
  COTW_STARTER_KIT,
  COTW_AFFINITY_MATRIX,
  COTW_EQUIPMENT_SLOTS,
  COTW_VAULTS,
  COTW_SPRITE_RECIPES,
};
