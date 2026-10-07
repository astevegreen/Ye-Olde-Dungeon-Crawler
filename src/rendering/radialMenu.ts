import type { GameEngine } from '../engine';
import { drawIconCentered } from './canvasIcons';
import { COMPANION_WHEEL_SIZE, type CompanionWheelSlot } from '../ui/companionWheel';
import { resolveThemeTokens, uiFont, withAlpha } from './theme';

/**
 * The radial menu, dedicated to the companion: the companion wheel (`companionWheel.ts`,
 * docs/architecture/simulation-and-input.md).
 *
 * A hold-to-open canvas overlay: `InputHandler` fills it from `companionWheelSlots` and
 * opens it on the configurable `radial_menu` action keydown, routes the existing
 * directional-key vocabulary (arrows/WASD/vi/numpad) to `setHoveredDirection()` while it
 * is open instead of moving the player, and confirms the hovered slot on that same key's
 * release. Gamepad input is not implemented (deferred — see ARCHITECTURE.md P-24).
 */
export type RadialDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

/** Fixed 8-direction order — the companion wheel's slots are keyed by this same order. */
export const RADIAL_DIRECTIONS: readonly RadialDirection[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class RadialMenuOverlay {
  public isOpen = false;
  /** Set by `InputHandler` from `companionWheelSlots` each time the wheel opens. */
  public slots: (CompanionWheelSlot | null)[] = new Array(COMPANION_WHEEL_SIZE).fill(null);
  private hoveredDirection: RadialDirection | null = null;

  public open(): void {
    this.isOpen = true;
    this.hoveredDirection = null;
  }

  public close(): void {
    this.isOpen = false;
    this.hoveredDirection = null;
  }

  public setHoveredDirection(direction: RadialDirection): void {
    if (!this.isOpen) return;
    this.hoveredDirection = direction;
  }

  public getHoveredDirection(): RadialDirection | null {
    return this.hoveredDirection;
  }

  /** The slot config currently hovered, or null if nothing is hovered or that slot is empty. */
  public getSelectedSlot(): CompanionWheelSlot | null {
    if (!this.hoveredDirection) return null;
    const idx = RADIAL_DIRECTIONS.indexOf(this.hoveredDirection);
    return this.slots[idx] ?? null;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    canvasW: number,
    canvasH: number,
    drawCenter?: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void
  ): void {
    if (!this.isOpen) return;

    const theme = resolveThemeTokens(engine.manifest?.theme);
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const outerRadius = Math.min(canvasW, canvasH) * 0.28;
    const innerRadius = outerRadius * 0.35;
    const wedgeAngle = (Math.PI * 2) / RADIAL_DIRECTIONS.length;

    // Dim backdrop so the wheel reads clearly without fully blocking the view.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    RADIAL_DIRECTIONS.forEach((dir, i) => {
      // Wedge 0 (N) centered at -90deg; proceed clockwise to match compass order.
      const startAngle = -Math.PI / 2 - wedgeAngle / 2 + i * wedgeAngle;
      const endAngle = startAngle + wedgeAngle;
      const slot = this.slots[i];
      const isHovered = dir === this.hoveredDirection;

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(startAngle) * innerRadius, cy + Math.sin(startAngle) * innerRadius);
      ctx.arc(cx, cy, outerRadius, startAngle, endAngle);
      ctx.arc(cx, cy, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = isHovered ? theme.accent : slot ? theme.cardBg : withAlpha(theme.surface2, 0.55);
      ctx.fill();
      ctx.strokeStyle = theme.cardBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label at wedge midpoint.
      const midAngle = (startAngle + endAngle) / 2;
      const labelRadius = (innerRadius + outerRadius) / 2;
      const lx = cx + Math.cos(midAngle) * labelRadius;
      const ly = cy + Math.sin(midAngle) * labelRadius;
      ctx.font = uiFont('xs', font, 'bold');
      ctx.fillStyle = isHovered ? theme.titlebarText : slot ? theme.text : theme.textMuted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = slot ? slot.label : '—';
      ctx.fillText(label, lx, ly, outerRadius * 0.7);
    });

    // Center hub: an open ring with the companion (or, while it is away, the hero) inside
    ctx.beginPath();
    ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    ctx.stroke();

    const centerSize = Math.round(innerRadius * 1.3);
    if (drawCenter) {
      drawCenter(ctx, cx, cy, centerSize);
    } else {
      drawIconCentered(ctx, 'shield', cx, cy, centerSize);
    }

    ctx.restore();
  }
}
