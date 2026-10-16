import type { BotTelemetry } from './playerBot';

export type FindingCategory = 'bug' | 'softlock' | 'text' | 'ux';
export type FindingSeverity = 'S1' | 'S2' | 'S3' | 'S4';
export type SoakPolicy = 'chaos' | 'player' | 'ui-sweep';
export type SoakOpening = 'play' | 'skip';

export interface Finding {
  sig: string;
  category: FindingCategory;
  severity: FindingSeverity;
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
  /** Distinct signatures per category in this run. */
  findingCounts: Record<FindingCategory, number>;
  /** Every signature seen in this run, with how many times it fired. */
  findings: Record<string, number>;
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
}

/** Who dealt damage to the hero's foes: a cast, a step or blow, another hero action, or the world. */
type DamageSource = 'spell' | 'melee' | 'other' | 'world';

interface MagicFloorTally {
  /** Casts that spent the turn, by spell id. */
  casts: Record<string, number>;
  /** Casts that spent nothing (no target, out of range, refused). */
  failedCasts: number;
  damage: Record<DamageSource, number>;
  kills: Record<DamageSource, number>;
  /** The `spell` damage, by spell id. */
  spellDamage: Record<string, number>;
}

export interface MagicTelemetry {
  /** By floor number as a string; "0" is town and the raid. */
  floors: Record<string, MagicFloorTally>;
  /** Each spell that joined the book after the start, in order. */
  learned: Array<{ spellId: string; via: 'stone' | 'shortcut' | 'other'; floor: number; turn: number }>;
  stonesRead: number;
  /** Stones read through a carrier's rite. */
  shortcuts: number;
  /** Stones whose shard became an Essence-Rune instead. */
  runesFromStones: number;
  rites: number;
  altarRites: number;
  spellsKnown: string[];
}

