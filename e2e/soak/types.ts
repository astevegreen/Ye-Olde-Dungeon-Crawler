import type { BotTelemetry } from './playerBot';

export type FindingCategory = 'bug' | 'softlock' | 'text' | 'ux';
export type FindingSeverity = 'S1' | 'S2' | 'S3' | 'S4';
export type SoakPolicy = 'chaos' | 'player' | 'ui-sweep';
export type SoakOpening = 'play' | 'skip';
/**
 * Marks a finding that is real but noisy, so counts can leave it out: `latency` is
 * wall-clock and moves with machine load; `pacing` is the bot's route, not the game.
 */
export type FindingTag = 'latency' | 'pacing';
/** Distinct signatures per category, tagged ones counted apart (`countFindings`). */
export type FindingCounts = Record<FindingCategory, number> & { tagged: number };

export interface Finding {
  sig: string;
  category: FindingCategory;
  severity: FindingSeverity;
  tag?: FindingTag;
  lens: string;
  seed: number;
  opening: SoakOpening;
  sha: string;
  action: number;
  turn: number;
  floor: number;
  detail: string;
  lastActions: string;
  screenshot: string;
  trace: string;
  save: string;
  repro: string;
}

export interface ActionLogEntry {
  i: number;
  turn: number;
  key?: string;
  click?: { x: number; y: number };
  pos: { x: number; y: number } | string;
  hp: number;
  floor: number;
  stack: string[];
}

export interface SoakSummary {
  seed: number;
  lens: string;
  opening: SoakOpening;
  /** The floor a deep-floor start dropped the hero onto (SOAK_START_FLOOR); 0 for a run from town. */
  startFloor: number;
  sha: string;
  /** True for the snapshot written every 100 actions; false once the run is over. */
  partial: boolean;
  endedBy: string;
  turnsPlayed: number;
  deepestFloor: number;
  causeOfDeath: string | null;
  wallTimeMs: number;
  actionsPlayed: number;
  /** Keypress to the game answering, for map keys pressed on the open map. */
  latency: {
    samples: number;
    p50: number;
    p95: number;
    max: number;
  };
  /** Distinct signatures per category in this run; tagged ones only under `tagged`. */
  findingCounts: FindingCounts;
  /** Every signature seen in this run, with how many times it fired. */
  findings: Record<string, number>;
  /** The tag of each tagged signature in `findings`; `{}` when none was tagged. */
  findingTags: Record<string, FindingTag>;
  raid: {
    ending: string;
    villagersFreed: number;
    villagerTurns: Record<string, number>;
    /** The turn the raid ended on (it starts on turn 0); null while it runs. */
    turnsUsed: number | null;
    drinkCueShowed: boolean;
    potionDrunk: boolean;
    raidLogLines: number | null;
  };
  deadKeys: number;
  /** Dialogs that opened on a move or wait key, by stack id. */
  interruptions: Record<string, number>;
  stuckEpisodes?: number;
  /** The player bot's gear (Q40): pieces put on, bought and sold, the trip home, and the
   *  hero's attack and defense when the run ended. */
  gear?: { equips: number; purchases: number; sales: number; townTrip: string; attack: number; defense: number };
  /** The player bot's telemetry: potions, telegraphs, services, points, and why it died. */
  bot?: BotTelemetry;
  /** Magic in play (P-36, `magicTap.ts`), for every lens. */
  magic?: MagicTelemetry;
  /** Per floor, by floor number as a string; "0" is town and the raid (P-36). */
  pace?: Record<string, FloorPace>;
  /** Turns spent below town, as the Hearth-Tear cold counts them (`hearthCold.ts`). */
  belowTurns?: number;
  hero?: HeroOutcome;
}

/** Who dealt damage to the hero's foes: a cast, a step or blow, another hero action, or the world. */
type DamageSource = 'spell' | 'melee' | 'other' | 'world';

interface MagicFloorTally {
  /** Casts that spent the turn, by spell id. */
  casts: Record<string, number>;
  /** Casts that spent nothing (no target, out of range, refused), by spell id. */
  failed: Record<string, number>;
  damage: Record<DamageSource, number>;
  kills: Record<DamageSource, number>;
  /** The `spell` damage and kills, by spell id. */
  spellDamage: Record<string, number>;
  spellKills: Record<string, number>;
  /** Casts by spell id, then by each flavour its grimoire neighbours lent it (Knockback, Chill). */
  lent?: Record<string, Record<string, number>>;
}

export interface MagicTelemetry {
  /** By floor number as a string; "0" is town and the raid. */
  floors: Record<string, MagicFloorTally>;
  /** Each spell that joined the book after the start, in order, and the route it came by. */
  learned: Array<{ spellId: string; via: 'stone' | 'shortcut' | 'altar' | 'rite' | 'other'; floor: number; turn: number }>;
  stonesRead: number;
  /** Stones read through a carrier's rite. */
  shortcuts: number;
  /** Stones whose shard became an Essence-Rune instead. */
  runesFromStones: number;
  rites: number;
  altarRites: number;
  spellsKnown: string[];
  /** Each learning stone on a floor the hero entered, by floor: read, reached (stood at, not read) or missed. */
  stones: Record<string, 'read' | 'reached' | 'missed'>;
  /** Each spell altar on a floor the hero entered, by "floor:altarId": performed, reached or missed. */
  altars: Record<string, 'performed' | 'reached' | 'missed'>;
  /**
   * Every spell in the pack: its type, the first floor whose stone teaches it (null: no stone
   * does), and whether its own effects hurt (a damage or push effect); damage a cast of one
   * that doesn't deals comes from what its neighbours lent it.
   */
  catalog: Record<string, { type: string; stoneFrom: number | null; ownDamage?: boolean }>;
  /** Energy spent, by floor ("0": town and the raid), for the hero and every other actor
   *  (`foes`). Absent from soaks before 21 Oct 2026. */
  energy?: Record<string, { hero: EnergyTally; foes: EnergyTally }>;
}

/** One actor group's `consumeEnergy` calls on a floor. */
interface EnergyTally {
  actions: number;
  /** Calls dearer than the energy banked before them. */
  debt: number;
  /** Over those calls, `amount - max(0, energy before)`: what the old floor at 0 forgave. */
  debtEnergy: number;
}

/** One floor's pace (P-36): what the hero spent there, over every visit. */
export interface FloorPace {
  /** Game turns (each spends the hero's energy: a step, a blow, a rest step). */
  turns: number;
  /** Bot actions: key presses and clicks, dialogs included. */
  actions: number;
  wallMs: number;
  visits: number;
  /** The turn the hero first set foot on the floor, and how many spells it knew then. */
  firstTurn: number;
  spellsOnEntry: number;
}

/** Who the hero was when the run ended: joins magic and pace to the outcome. */
export interface HeroOutcome {
  /** The bot's build (`playerBot.ts` BUILDS); `chaos` for the chaos lens. */
  build: string;
  /** The bot's Runestone policy: first gift, second gift, or leave untouched. */
  runestonePolicy: string;
  level: number;
  stats: { str: number; int: number; con: number; dex: number };
  maxHp: number;
  maxMana: number;
  /** Runestones answered, by choice id: the option taken, `left`, or `granted:<option>` by a deep start. */
  runestones: Record<string, string>;
}
