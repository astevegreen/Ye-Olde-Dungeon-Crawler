import type {
  ActionHook,
  ChoiceDefinition,
  FactionDefinition,
  FixedTilePlacement,
  HeroMarkDefinition,
  Predicate,
  ScriptedVaultPlacement,
  TileDefinition,
  TrackedMilestoneDefinition,
} from '../../engine';
import { MovementAction, NPC, getFlag, modifyFaction, setFlag } from '../../engine';

/**
 * Act II, "The Rot Below" (docs/sprint.md): a blight eats Yggdrasil's roots under floors
 * 26-49. The Sap-tappers drive silver spigots into the roots and drink the sap; the Rot is
 * what leaks, and Níðhögg gnaws behind it. Three hubs, one per stretch of Act II, each hold
 * one NPC and one choice: take the tappers' offer (tapped) or mend the root (mended). The
 * ending reads the tally of the two counters; the faction's standing is only its mirror.
 *
 * This file holds every Act II piece, each joined to the pack by one spread line at the end
 * of its array, so later items edit only this file.
 */

export const SAP_TAPPERS_FACTION_ID = 'sap_tappers';
export const SAP_TAPPERS_MET_FLAG = 'sap_tappers_met';

/** The tally: each hub choice adds one to either counter. */
export const ROT_TAPPED_COUNTER = 'rot_tapped';
export const ROT_MENDED_COUNTER = 'rot_mended';

/** The hubs' NPCs (floors 26, 34 and 43); their names and words come with their hubs. */
export const ROT_DESERTER_ID = 'npc-rot-deserter';
export const ROT_ROOT_WARDEN_ID = 'npc-rot-root-warden';
export const ROT_ELDER_ID = 'npc-rot-elder';
export const ROT_HUB_NPC_IDS: readonly string[] = [ROT_DESERTER_ID, ROT_ROOT_WARDEN_ID, ROT_ELDER_ID];

/** Set once each hub's choice is settled, and once the Great Tap is broken. */
export const ROT_HUB_26_RESOLVED_FLAG = 'rot_hub_26_resolved';
export const ROT_HUB_34_RESOLVED_FLAG = 'rot_hub_34_resolved';
export const ROT_HUB_43_RESOLVED_FLAG = 'rot_hub_43_resolved';
export const GREAT_TAP_BROKEN_FLAG = 'great_tap_broken';

/** Set when the hero drinks from the elder's cup: the "Sap-drunk" mark. */
export const ROT_SAP_DRUNK_FLAG = 'rot_sap_drunk';

export const SAP_TAPPERS_FACTION: FactionDefinition = {
  id: SAP_TAPPERS_FACTION_ID,
  name: 'Sap-tappers',
  metFlag: SAP_TAPPERS_MET_FLAG,
};

/**
 * The ending reads "Tapped" from this many tapped choices (Sprint question 1, its
 * recommended answer (a)); a hero who skipped the hubs reads "Mended".
 */
export const ROT_TAPPED_THRESHOLD = 2;
export const ROT_TAPPED_ENDING: Predicate = { type: 'minCounter', counter: ROT_TAPPED_COUNTER, value: ROT_TAPPED_THRESHOLD };
export const ROT_MENDED_ENDING: Predicate = { type: 'not', predicate: ROT_TAPPED_ENDING };

export const ROT_MARKS: HeroMarkDefinition[] = [
  {
    id: 'rot_sap_drunk',
    label: 'Sap-drunk',
    when: { type: 'hasFlag', flag: ROT_SAP_DRUNK_FLAG },
    hudColor: 'var(--ui-rarity-unholy)',
    detail: 'you drank the root’s sap from the tapper elder’s cup',
  },
];

/** Act II's Story milestones, one per hub and one for the Great Tap. */
export const ROT_TRACKED_MILESTONES: TrackedMilestoneDefinition[] = [
  {
    flag: ROT_HUB_26_RESOLVED_FLAG,
    label: 'The Deserter’s Fire',
    description: 'Heard the Sap-tapper deserter by her fire in the Tarnished Silver Veins, and settled the spigot she fled.',
    icon: '🔥',
    riddle: 'In the tarnished veins, one who threw down her spigot keeps a lonely fire. Ask her why she ran.',
  },
  {
    flag: ROT_HUB_34_RESOLVED_FLAG,
    label: 'The Root-Warden’s Word',
    description: 'Heard the bark-skinned root-warden of the World-Bark tell of the Great Tap, and gave her an answer.',
    icon: '🌿',
    riddle: 'Down the world-bark, one with bark for skin still guards the root. She knows what the tappers dig toward.',
  },
  {
    flag: ROT_HUB_43_RESOLVED_FLAG,
    label: 'The Elder’s Cup',
    description: 'Faced the Sap-tapper elder at the brink of the Maw, who speaks for Níðhögg, and answered her cup.',
    icon: '🏺',
    riddle: 'At the brink of the wyrm’s maw an old tapper holds out a cup. Drink or deny it, she will name whom the sap feeds.',
  },
  {
    flag: GREAT_TAP_BROKEN_FLAG,
    label: 'The Great Tap Broken',
    description: 'Broke the tappers’ great spigot on the fortieth floor before it opened.',
    icon: '⚒️',
    riddle: 'Forty stairs down, the tappers drive their greatest spigot into the root. Break it before it runs.',
  },
];

/**
 * Bumping a hub NPC is meeting the Sap-tappers; the talk itself goes ahead. A save from
 * before Act II has no `sap_tappers` standing, so the meeting adds it at 0.
 */
const ROT_MET_HOOK: ActionHook = {
  id: 'cotw-rot-met',
  phase: 'pre',
  actionType: 'MovementAction',
  execute: ({ action, actor, engine }) => {
    if (actor !== engine.player || !(action instanceof MovementAction) || getFlag(engine.worldState, SAP_TAPPERS_MET_FLAG)) return;
    const target = engine.map.getEntityAt(actor.x + action.dx, actor.y + action.dy, actor.planeId);
    if (!(target instanceof NPC) || !ROT_HUB_NPC_IDS.includes(target.id)) return;
    setFlag(engine.worldState, SAP_TAPPERS_MET_FLAG, true);
    modifyFaction(engine.worldState, SAP_TAPPERS_FACTION_ID, 0);
  },
};

export const ROT_HOOKS: ActionHook[] = [ROT_MET_HOOK];

/** Act II's tiles, choices and placements: filled by the hub and Great Tap items. */
export const ROT_TILES: TileDefinition[] = [];
export const ROT_CHOICES: Record<string, ChoiceDefinition> = {};
export const ROT_FIXED_TILE_PLACEMENTS: FixedTilePlacement[] = [];
export const ROT_SCRIPTED_VAULT_PLACEMENTS: ScriptedVaultPlacement[] = [];
