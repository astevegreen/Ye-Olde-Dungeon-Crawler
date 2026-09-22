/**
 * Presentation layer shared types for 2D rendering and canvas overlays.
 */

export interface ClickZone {
  x: number;
  y: number;
  width: number;
  height: number;
  action: (isMultiModifier?: boolean) => void;
}
