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
