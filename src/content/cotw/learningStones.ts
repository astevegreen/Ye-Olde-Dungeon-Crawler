import type { LearningStoneConfig, LearningStoneDefinition } from '../../engine';
import { COTW_RUNESTONE_SHARD } from './items/essences';

/**
 * Learning stones (P-34): a broken runestone on every even floor from 4 to 48 except 22, whose
 * Siphon Altar is that floor's spell moment. A monster of the floor carries the shard; set in
 * the stone it shows two spells the hero doesn't know. The carrier's own kind has a rite
 * (`killRites.ts`) that is the shortcut: the kill opens the card on the spot and the spell costs
 * a tenth less for the run.
 *
 * Six stones are the lore runestones (`runestones.ts`): floors 8, 14, 20, 28, 38 and 48 keep
 * their verse and their two choices, and the shard shows the faces besides.
 *
 * Zone lists hold the spells first found in a band of floors. A band with none (floors 43-49)
 * lends a face from the one before.
 */

/** The six lore runestones, by floor. */
const LORE_STONE_FLOORS: Record<number, string> = {
  8: 'skaldic_runestone_1',
  14: 'skaldic_runestone_2',
  20: 'skaldic_runestone_3',
  28: 'skaldic_runestone_4',
  38: 'skaldic_runestone_5',
  48: 'skaldic_runestone_6',
};

function buildStones(): LearningStoneDefinition[] {
  const stones: LearningStoneDefinition[] = [];
  for (let floor = 4; floor <= 48; floor += 2) {
    if (floor === 22) continue;
    const def: LearningStoneDefinition = { floor };
    const lore = LORE_STONE_FLOORS[floor];
    if (lore) def.tileId = lore;
    // The first stone is fixed: fight or flee, carried by a kobold finished with Magic Arrow.
    if (floor === 4) {
      def.faces = ['firebolt', 'phase_door'];
      def.carrierId = 'kobold';
    }
    stones.push(def);
  }
  return stones;
}

export const COTW_LEARNING_STONES: LearningStoneConfig = {
  tileId: 'broken_runestone',
  shardItemId: COTW_RUNESTONE_SHARD.id,
  shortcutCostMultiplier: 0.9,
  stones: buildStones(),
  zones: [
    {
      // The cold band's foes are fire-weak; Slow handles fast wolves and howlers.
      minFloor: 1,
      maxFloor: 9,
      spellIds: ['firebolt', 'slow', 'phase_door', 'call_the_pack', 'fafnirs_breath', 'sols_glare'],
      carrierIds: ['kobold', 'skratti', 'hoarfrost_skraeling', 'brim_howler', 'winter_hag'],
    },
    {
      minFloor: 10,
      maxFloor: 17,
      spellIds: ['cold_ray', 'hammer_throw', 'rockfall', 'loki_switch', 'hlidskjalf', 'mire'],
      carrierIds: ['forge_wretch', 'cinder_gilded_duergar', 'bellows_automaton', 'ogre'],
    },
    {
      minFloor: 18,
      maxFloor: 25,
      spellIds: ['rime_floor', 'shroud_of_mani', 'raise_cairn', 'drench'],
      carrierIds: ['sol_brand_zealot', 'prismatic_mirror_skulker', 'ironwood_troll_wife', 'fire_giant'],
    },
    {
      minFloor: 26,
      maxFloor: 33,
      spellIds: ['thunderclap', 'paralyze', 'fireball'],
      // Gloom-Tarr carries floor 30's shard (the floor's boss, its zone's own kind).
      carrierIds: ['quicksilver_leech', 'nar', 'dark_sorcerer', 'silver_wight', 'miniboss_tar_abomination'],
    },
    {
      minFloor: 34,
      maxFloor: 42,
      spellIds: ['fylgja', 'rime_thurs'],
      // Svartr carries floor 36's shard.
      carrierIds: ['amber_sap_weeper', 'yggdrasil_parasite', 'root_bound_berserker', 'ividja', 'miniboss_rot_matriarch'],
    },
    {
      minFloor: 43,
      maxFloor: 49,
      spellIds: [],
      carrierIds: ['garmling', 'nastrond_feaster', 'malice_weaver', 'shadow_fiend'],
    },
  ],
  messages: {
    arrival: 'A broken runestone hums somewhere on this floor, and {monster} sleeps with its shard.',
    stoneFound: '{stone} hums, missing a splinter. {monster} on this floor carries it.',
    shardMarks: 'The shard sings, and {stone} answers: you feel where it stands.',
    shortcut: "*** {monster}'s death rings out! Its shard is yours to set in {stone} from here, a tenth cheaper. ***",
    learned: '{stone} shows you {spell}, and you keep it.',
    rune: 'The shard crumbles into {essence}.',
  },
};
