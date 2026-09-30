import type { Camera } from './camera';
import type { ThemeTokens } from '../engine';

export interface FloatingText {
  id: number;
  worldX: number;
  worldY: number;
  text: string;
  color: string;
  strokeColor: string;
  fontSize: number;
  startTime: number;
  durationMs: number;
  driftX: number;
  driftY: number;
  isCrit?: boolean;
}

export interface FloatingTextRunnerOptions {
  onFrame?: () => void;
}

export class FloatingTextRunner {
  private activeTexts: FloatingText[] = [];
  private nextId = 1;
  private animationFrameId: number | null = null;
  public onFrame?: () => void;

  constructor(options: FloatingTextRunnerOptions = {}) {
    this.onFrame = options.onFrame;
  }

  public get isPlaying(): boolean {
    return this.activeTexts.length > 0;
  }

  public getActiveCount(): number {
    return this.activeTexts.length;
  }

  public spawnDamage(
    worldX: number,
    worldY: number,
    amount: number,
    options: {
      isPlayer?: boolean;
      element?: string;
      killed?: boolean;
      isCrit?: boolean;
    } = {}
  ): void {
    const isPlayer = options.isPlayer ?? false;
    const isCrit = options.isCrit ?? false;
    let color = isPlayer ? '#ef4444' : '#f8fafc';
    const stroke = '#000000';
    let text = `-${amount}`;

    if (options.killed && !isPlayer) {
      text = `-${amount} FATAL!`;
      color = '#fde047';
    } else if (isCrit) {
      text = `-${amount} CRIT!`;
      color = '#facc15';
    } else if (options.element === 'cold' || options.element === 'frost') {
      color = '#38bdf8';
    } else if (options.element === 'fire') {
      color = '#fb923c';
    } else if (options.element === 'poison' || options.element === 'acid') {
      color = '#4ade80';
    } else if (options.element === 'lightning') {
      color = '#c084fc';
    }

    this.spawnText(worldX, worldY, text, {
      color,
      strokeColor: stroke,
      isCrit,
      durationMs: isCrit ? 1100 : 850,
      fontSize: isCrit ? 14 : 12,
    });
  }

  public spawnHeal(worldX: number, worldY: number, amount: number): void {
    this.spawnText(worldX, worldY, `+${amount}`, {
      color: '#22c55e',
      strokeColor: '#052e16',
      durationMs: 900,
      fontSize: 12,
    });
  }

  public spawnText(
    worldX: number,
    worldY: number,
    text: string,
    options: {
      color?: string;
      strokeColor?: string;
      fontSize?: number;
      durationMs?: number;
      isCrit?: boolean;
    } = {}
  ): void {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    // Stagger slightly so multiple numbers on the same tile don't completely overlap
    const existingAtTile = this.activeTexts.filter(
      (t) => t.worldX === worldX && t.worldY === worldY && now - t.startTime < 350
    );
    const staggerY = existingAtTile.length * 10;
    const driftX = ((this.nextId % 5) - 2) * 3;

    this.activeTexts.push({
      id: this.nextId++,
      worldX,
      worldY,
      text,
      color: options.color ?? '#f8fafc',
      strokeColor: options.strokeColor ?? '#000000',
      fontSize: options.fontSize ?? 12,
      startTime: now,
      durationMs: options.durationMs ?? 850,
      driftX,
      driftY: -26 - staggerY,
      isCrit: options.isCrit ?? false,
    });

    if (!this.animationFrameId && typeof window !== 'undefined' && typeof requestAnimationFrame !== 'undefined') {
      this.startLoop();
    }
  }

  private startLoop(): void {
    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') return;

    const step = () => {
      const now = performance.now();
      this.activeTexts = this.activeTexts.filter((t) => now - t.startTime < t.durationMs);

      if (this.onFrame) {
        this.onFrame();
      }

      if (this.activeTexts.length > 0) {
        this.animationFrameId = requestAnimationFrame(step);
      } else {
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    theme?: ThemeTokens
  ): void {
    if (this.activeTexts.length === 0) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const font = theme?.fontFamily ?? '"Courier New", Courier, monospace';

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const item of this.activeTexts) {
      const elapsed = now - item.startTime;
      const progress = Math.min(1, Math.max(0, elapsed / item.durationMs));

      // Ease out quadratic for natural upward float deceleration
      const easeOut = 1 - Math.pow(1 - progress, 2);
      const curDriftX = item.driftX * easeOut;
      const curDriftY = item.driftY * easeOut;

      // Fade out during the last 35% of duration
      let alpha = 1;
      if (progress > 0.65) {
        alpha = Math.max(0, 1 - (progress - 0.65) / 0.35);
      }

      const screenPos = camera.worldToScreen(item.worldX, item.worldY, cellSize, offsetX, offsetY);
      if (!screenPos) continue;

      const cx = screenPos.x + cellSize / 2 + curDriftX;
      // Start near the top half of the entity tile and float upwards
      const cy = screenPos.y + cellSize * 0.25 + curDriftY;

      // Subtle scale pop on spawn
      let scale = 1;
      if (progress < 0.15) {
        scale = 0.85 + (progress / 0.15) * 0.25; // 0.85 -> 1.10
      } else if (progress < 0.3) {
        scale = 1.1 - ((progress - 0.15) / 0.15) * 0.1; // 1.10 -> 1.00
      }

      ctx.save();
      ctx.translate(cx, cy);
      if (scale !== 1) {
        ctx.scale(scale, scale);
      }
      ctx.globalAlpha = alpha;

      ctx.font = `bold ${item.fontSize}px ${font}`;

      // Thick high-contrast dark stroke for readability over any background
      ctx.strokeStyle = item.strokeColor;
      ctx.lineWidth = 3;
      ctx.lineJoin = 'round';
      ctx.strokeText(item.text, 0, 0);

      // Bright colored fill
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, 0, 0);

      ctx.restore();
    }

    ctx.restore();
  }

  public clear(): void {
    this.activeTexts = [];
  }

  public destroy(): void {
    if (this.animationFrameId && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.activeTexts = [];
  }
}
