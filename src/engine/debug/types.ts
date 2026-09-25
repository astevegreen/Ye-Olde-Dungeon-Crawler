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

export interface DiagnosticReportOptions {
  includeSnapshot?: boolean;
  maxEvents?: number;
  devicePixelRatio?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  userAgent?: string;
  category?: string;
  subject?: string;
  userNotes?: string;
  error?: Error | string;
  includeMap?: boolean;
  mapRadius?: number;
}

export interface DiagnosticPackageMetadata {
  timestamp: number;
  isoTimestamp: string;
  engineVersion: string;
  manifestId: string;
  manifestName: string;
  turnCount?: number;
  floor?: number;
  prngState?: number;
  error?: string;
  userAgent?: string;
  display?: string;
  category?: string;
  subject?: string;
}

export interface DiagnosticReproductionContext {
  manifestId: string;
  floor: number;
  turn: number;
  prngState?: number;
  playerCoords: { x: number; y: number };
  recentActions: string[];
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
