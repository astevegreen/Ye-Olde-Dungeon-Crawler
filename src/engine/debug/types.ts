export type FlightEventType =
  | 'input'
  | 'scheduler'
  | 'combat'
  | 'spell'
  | 'state'
  | 'error'
  | 'warning';

export interface FlightEvent {
  id: number;
  timestamp: number;
  type: FlightEventType;
  summary: string;
  details?: Record<string, unknown>;
}

/**
 * What a bug report is about. The engine scopes the flight log by this id; the
 * player-facing category label lives in the UI and maps onto it.
 */
export type BugReportScope = 'crash' | 'combat' | 'items' | 'map' | 'visual' | 'balance' | 'other';

/** A scalar action parameter, or a flat object of them (e.g. a direction). */
export type TrailValue = string | number | boolean | Record<string, string | number | boolean>;

/** One player action as `handlePlayerAction` received it, in replayable form. */
export interface TrailEntry {
  seq: number;
  turn: number;
  floor: number;
  /** `action.actionType` if set, else the class name (§4). */
  action: string;
  /** Scalar fields; an entity or item field `foo` is recorded as its id, `fooId`. */
  params: Record<string, TrailValue>;
}

/** The game as it stood just before the first action of the trail. */
export interface ReplayCheckpoint {
  reason: string;
  turn: number;
  floor: number;
  /** `serializeGame()` output: load it and replay the trail to reach the reported state. */
  save: unknown;
}

export interface ReplayData {
  checkpoint: ReplayCheckpoint;
  trail: TrailEntry[];
}

export interface DiagnosticReportOptions {
  includeSnapshot?: boolean;
  maxEvents?: number;
  devicePixelRatio?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  userAgent?: string;
  /** Player-facing category label, shown as-is. */
  category?: string;
  /** Drives log scoping and default sections; unset means everything. */
  scope?: BugReportScope;
  subject?: string;
  userNotes?: string;
  error?: Error | string;
  includeMap?: boolean;
  mapRadius?: number;
  /** Include the replay checkpoint and action trail (default: follows includeSnapshot). */
  includeReplay?: boolean;
  /** package.json version of the running build. */
  appVersion?: string;
  /** Commit the running build was made from, so stack positions can be mapped to source. */
  buildId?: string;
}

export interface DiagnosticPackageMetadata {
  timestamp: number;
  isoTimestamp: string;
  engineVersion: string;
  buildId?: string;
  manifestId: string;
  manifestName: string;
  turnCount?: number;
  floor?: number;
  prngState?: number;
  error?: string;
  userAgent?: string;
  display?: string;
  category?: string;
  scope?: BugReportScope;
  subject?: string;
}

export interface DiagnosticReproductionContext {
  manifestId: string;
  floor: number;
  turn: number;
  prngState?: number;
  playerCoords: { x: number; y: number };
  recentActions: string[];
  /** Checkpoint plus every action since it; absent when replay data was left out. */
  replay?: ReplayData;
  reproductionHint: string;
}

export interface DiagnosticPackage {
  metadata: DiagnosticPackageMetadata;
  summary: string;
  asciiMap?: string;
  flightLog: FlightEvent[];
  stateSnapshot?: unknown;
  reproduction?: DiagnosticReproductionContext;
  markdownReport?: string;
}

export interface DiagnosticPackageOptions extends DiagnosticReportOptions {}
