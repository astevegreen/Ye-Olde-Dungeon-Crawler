import type { ThresholdRoomDefinition } from '../../engine';

/**
 * The room each zone's first floor opens in (`FloorLayoutBand.threshold`), so crossing into
 * a new zone is an event. '@' is where the hero arrives, on the up stairs; walkable cells
 * on the edge are the ways out. Pillars, doors, liquid and chasm take the zone's own look.
 * The Rotting Root has none: its one floor, 50, is the Heartwood lair (`lair.ts`).
 */
export const COTW_THRESHOLDS: Record<string, ThresholdRoomDefinition> = {
  // Rime Hollows: the cellar stair comes down into an ice grotto, with a frozen pool.
  rime_hollows: {
    layout: [
      '#############',
      '###P.....P###',
      '##.........##',
      '#...........#',
      '......@......',
      '#...........#',
      '##...~~~...##',
      '###P.....P###',
      '#############',
    ],
  },
  // Abandoned Dwarven Works: the gatehouse. A guardroom, a portcullis with its wicket door,
  // the outer hall, and the great door into the Works.
  dwarven_works: {
    layout: [
      '#############',
      '#P....@....P#',
      '#...........#',
      '#P.........P#',
      '#####B+B#####',
      '#...........#',
      '#...........#',
      '#P.........P#',
      '######+######',
    ],
  },
  // Obsidian Siphon: the lip of the rift. A ledge over the fire, and one narrow natural
  // bridge across it.
  obsidian_siphon: {
    layout: [
      '###############',
      '#.....@.......#',
      '#.............#',
      '#P...........P#',
      '#XXXXX...XXXXX#',
      '#XXXXXX.XXXXXX#',
      '#XXXXXX.XXXXXX#',
      '#XXXXX...XXXXX#',
      '#######.#######',
    ],
  },
  // Tarnished Silver Veins: the mine head. The ladder comes down between two old winze
  // shafts, timber props in the corners, and the drift runs off both ways.
  tarnished_silver: {
    layout: [
      '###############',
      '#P...........P#',
      '#..XXX...XXX..#',
      '#.............#',
      '.......@.......',
      '#.............#',
      '#P...........P#',
      '###############',
    ],
  },
  // World Bark Descent: a hollow inside a knot of the World Tree, with a door out through
  // the bark.
  world_bark: {
    layout: [
      '#############',
      '####.....####',
      '##P.......P##',
      '#...........#',
      '#.....@.....+',
      '#...........#',
      '##P.......P##',
      '####.....####',
      '#############',
    ],
  },
  // Maw of Malice: the jaws. A long row of teeth overhead, femurs standing in the mouth,
  // and the way on narrowing down the gullet.
  maw_of_malice: {
    layout: [
      '#############',
      '#...........#',
      '#..P.....P..#',
      '#.....@.....#',
      '#..P.....P..#',
      '#...........#',
      '###.......###',
      '#####...#####',
      '######.######',
    ],
  },
};
