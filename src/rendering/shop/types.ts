import type { ThemeTokens } from '../theme';

/** A clickable region a shop panel registers while rendering. */
export interface ClickZone {
  x: number;
  y: number;
  width: number;
  height: number;
  action: () => void;
}

/** Modal bounds shared by every shop panel renderer. */
export interface ShopPanelBounds {
  readonly modalX: number;
  readonly modalY: number;
  readonly modalW: number;
  readonly modalH: number;
  readonly startY: number;
}

/**
 * The only two things every shop panel needs from the owning `ShopOverlay`:
 * a resolved theme and somewhere to register click zones.
 *
 * Panels deliberately do NOT share one context object carrying the overlay's
 * whole state. Each renderer takes its own narrow `*Actions` interface instead,
 * so a panel can only reach the handful of behaviours it actually uses.
 */
export interface ShopPanelContext {
  readonly theme: Required<ThemeTokens>;
  addClickZone(zone: ClickZone): void;
}
