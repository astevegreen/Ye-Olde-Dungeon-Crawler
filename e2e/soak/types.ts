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
  turnsPlayed: number;
  deepestFloor: number;
  causeOfDeath: string | null;
  wallTimeMs: number;
  actionsPlayed: number;
  latency: {
    p50: number;
    p95: number;
    max: number;
  };
  findingCounts: {
    bug: number;
    softlock: number;
    text: number;
    ux: number;
  };
  raid?: {
    ending?: string;
    villagersFreed: number;
    villagerTurns: Record<string, number>;
    turnsUsed: number;
    drinkCueShowed: boolean;
    potionDrunk: boolean;
    raidLogLines: number;
  };
  deadKeys: number;
  unexpectedInterruptions: number;
}
