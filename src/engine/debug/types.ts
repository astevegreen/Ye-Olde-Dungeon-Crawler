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
}

export interface DiagnosticPackage {
  metadata: DiagnosticPackageMetadata;
  summary: string;
  asciiMap?: string;
  flightLog: FlightEvent[];
  stateSnapshot?: unknown;
}

export interface DiagnosticPackageOptions extends DiagnosticReportOptions {
  userNotes?: string;
  category?: string;
  subject?: string;
  error?: Error | string;
  includeMap?: boolean;
  mapRadius?: number;
}
