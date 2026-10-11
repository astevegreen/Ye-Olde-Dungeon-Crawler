import type { GameEngine } from '../engine';
import { drawIconCentered } from './canvasIcons';
import { COMPANION_WHEEL_SIZE, type CompanionWheelSlot } from '../ui/companionWheel';
import { mixColor, resolveThemeTokens, shadeColor, withAlpha } from './theme';

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

const TAU = Math.PI * 2;

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

  /**
   * The wheel as a carved rune-ring: eight stone segments with cut joints inside a dark rim
   * notched with rune-ticks, and a gold hub ring holding the companion (the hero while it is
   * away). The chosen stone is gold-lit and slides out from the ring. Crisp shapes on a dark
   * keyline, like the map markers. `t` is the marker clock (0 under Reduce motion): a glint
   * walks round the hub ring. Returns whether it drew something that moves.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    canvasW: number,
    canvasH: number,
    drawCenter?: (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => void,
    t = 0
  ): boolean {
    if (!this.isOpen) return false;

    const theme = resolveThemeTokens(engine.manifest?.theme);
    const ink = theme.markerInk;
    const stone = theme.wheelStone;
    const gold = theme.ally;
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const r = Math.min(canvasW, canvasH) * 0.28;
    const wedge = TAU / RADIAL_DIRECTIONS.length;
    const ri = r * 0.4;
    const rim = Math.max(4, r * 0.075);
    const lw = Math.max(1.5, r / 70);
    const fontPx = Math.max(10, Math.round(r * 0.095));

    // Dim backdrop so the wheel reads clearly without fully blocking the view.
    ctx.save();
    ctx.fillStyle = withAlpha(ink, 0.5);
    ctx.fillRect(0, 0, canvasW, canvasH);

    // The rim: a dark band notched with ticks, longer every fourth.
    ctx.beginPath();
    ctx.arc(cx, cy, r + rim, 0, TAU);
    ctx.arc(cx, cy, r + 1, TAU, 0, true);
    ctx.closePath();
    ctx.fillStyle = mixColor(stone, ink, 0.8);
    ctx.fill();
    ctx.strokeStyle = withAlpha(ink, 0.9);
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.strokeStyle = mixColor(stone, ink, 0.35);
    ctx.lineWidth = 1;
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * TAU - Math.PI / 2;
      const l = k % 4 === 0 ? rim * 0.85 : rim * 0.45;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r + 1.5), cy + Math.sin(a) * (r + 1.5));
      ctx.lineTo(cx + Math.cos(a) * (r + 1.5 + l), cy + Math.sin(a) * (r + 1.5 + l));
      ctx.stroke();
    }

    // The stone segments; wedge 0 (N) is centred at -90deg, then clockwise in compass order.
    const gap = 3 / r;
    RADIAL_DIRECTIONS.forEach((dir, i) => {
      const slot = this.slots[i];
      const isHovered = dir === this.hoveredDirection;
      const a0 = -Math.PI / 2 - wedge / 2 + i * wedge + gap;
      const a1 = a0 + wedge - gap * 2;
      const m = (a0 + a1) / 2;
      const push = isHovered ? r * 0.05 : 0;
      const ox = cx + Math.cos(m) * push;
      const oy = cy + Math.sin(m) * push;
      const seg = (ro: number, rin: number): void => {
        ctx.beginPath();
        ctx.arc(ox, oy, ro, a0, a1);
        ctx.arc(ox, oy, rin, a1, a0, true);
        ctx.closePath();
      };
      // The stone's face, lit from the upper left.
      const lit = isHovered ? shadeColor(gold, 0.64) : slot ? stone : mixColor(stone, ink, 0.55);
      const shade = isHovered ? shadeColor(gold, 0.32) : mixColor(lit, ink, slot ? 0.55 : 0.4);
      const face = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      face.addColorStop(0, lit);
      face.addColorStop(1, shade);
      seg(r, ri + 3);
      ctx.fillStyle = face;
      ctx.fill();
      ctx.strokeStyle = withAlpha(ink, 0.95);
      ctx.lineWidth = lw;
      ctx.stroke();
      // The carved panel inside each stone.
      seg(r - rim * 0.7, ri + 3 + rim * 0.7);
      ctx.strokeStyle = isHovered ? gold : slot ? withAlpha(theme.look, 0.12) : withAlpha(ink, 0.45);
      ctx.lineWidth = isHovered ? Math.max(1.5, lw) : 1;
      ctx.stroke();

      // The label, cut into the stone over a dark line; a long name breaks onto two lines.
      const lr = (ri + r) / 2 + push;
      const lx = cx + Math.cos(m) * lr;
      const ly = cy + Math.sin(m) * lr;
      ctx.font = `bold ${fontPx}px ${theme.fontDisplay}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = r * 0.56;
      const lines = labelLines(ctx, slot ? slot.label : '·', maxW);
      lines.forEach((line, k) => {
        const yy = ly + (k - (lines.length - 1) / 2) * fontPx * 1.05;
        ctx.fillStyle = withAlpha(ink, 0.9);
        ctx.fillText(line, lx, yy + 1, maxW);
        ctx.fillStyle = isHovered ? mixColor(gold, theme.look, 0.6) : slot ? theme.path : stone;
        ctx.fillText(line, lx, yy, maxW);
      });
    });

    // The hub: a dark well with the companion inside it.
    ctx.beginPath();
    ctx.arc(cx, cy, ri, 0, TAU);
    ctx.fillStyle = mixColor(ink, stone, 0.1);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, ri - 1, 0, TAU);
    ctx.clip();
    const size = Math.round(ri * 1.75);
    if (drawCenter) drawCenter(ctx, cx, cy - size * 0.08, size);
    else drawIconCentered(ctx, 'shield', cx, cy, Math.round(ri * 1.3));
    ctx.restore();

    // The gold ring round it, lit on its upper left, with a stud at each joint.
    const hw = Math.max(3, Math.round(r * 0.04));
    ctx.beginPath();
    ctx.arc(cx, cy, ri, 0, TAU);
    ctx.strokeStyle = withAlpha(ink, 0.95);
    ctx.lineWidth = hw + 3;
    ctx.stroke();
    ctx.strokeStyle = shadeColor(gold, 0.82);
    ctx.lineWidth = hw;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, ri - hw / 2 + 0.5, 0, TAU);
    ctx.strokeStyle = shadeColor(gold, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, ri + hw / 2 - 0.5, Math.PI * 1.05, Math.PI * 1.6);
    ctx.strokeStyle = mixColor(gold, theme.look, 0.5);
    ctx.stroke();
    // A glint that walks round the ring every 2.4 s; it rests at the top when motion is off.
    const ga = (t / 2400) * TAU - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, ri, ga, ga + 0.35);
    ctx.strokeStyle = mixColor(gold, theme.look, 0.75);
    ctx.lineWidth = Math.max(1, hw - 2);
    ctx.stroke();
    const st = Math.max(2, Math.round(hw * 0.9));
    for (let k = 0; k < RADIAL_DIRECTIONS.length; k++) {
      const a = -Math.PI / 2 - wedge / 2 + k * wedge;
      const sx = Math.round(cx + Math.cos(a) * ri);
      const sy = Math.round(cy + Math.sin(a) * ri);
      ctx.fillStyle = ink;
      ctx.fillRect(sx - st / 2 - 1, sy - st / 2 - 1, st + 2, st + 2);
      ctx.fillStyle = mixColor(gold, theme.look, 0.25);
      ctx.fillRect(sx - st / 2, sy - st / 2, st, st);
    }

    ctx.restore();
    return t > 0;
  }
}

/** A label on one line, or, when wider than `maxW`, broken at the space that leaves the narrowest pair. */
function labelLines(ctx: CanvasRenderingContext2D, label: string, maxW: number): string[] {
  if (ctx.measureText(label).width <= maxW || !label.includes(' ')) return [label];
  const words = label.split(' ');
  let best: string[] = [label];
  let bestW = Infinity;
  for (let k = 1; k < words.length; k++) {
    const pair = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
    const w = Math.max(...pair.map((s) => ctx.measureText(s).width));
    if (w < bestW) {
      best = pair;
      bestW = w;
    }
  }
  return best;
}
