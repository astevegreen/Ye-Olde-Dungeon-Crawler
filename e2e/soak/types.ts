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
}

