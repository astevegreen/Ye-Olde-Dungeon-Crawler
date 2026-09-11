import type { VisualEffectDescriptor, ProjectileEffectDescriptor, BurstEffectDescriptor, ScreenFlashEffectDescriptor, ChainLinkEffectDescriptor } from '../engine/types';
import type { Camera } from './camera';
import type { SpriteAtlas } from './atlas/sprite-atlas';

export type FXRunnerMode = 'retro' | 'smooth' | 'instant';

export interface FXRunnerOptions {
  mode?: FXRunnerMode;
  onFrame?: () => void;
}

interface ActiveProjectile {
  type: 'projectile';
  descriptor: ProjectileEffectDescriptor;
  currentStepIndex: number;
  progressInStep: number; // 0..1 for smooth interpolation
  totalSteps: number;
  startTime: number;
  completed: boolean;
  tailHistory: Array<{ x: number; y: number; alpha: number }>;
}

interface ActiveBurst {
  type: 'burst';
  descriptor: BurstEffectDescriptor;
  startTime: number;
  durationMs: number;
  completed: boolean;
  particles: Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
  }>;
}

interface ActiveScreenFlash {
  type: 'screen_flash';
  descriptor: ScreenFlashEffectDescriptor;
  startTime: number;
  durationMs: number;
  completed: boolean;
}

interface ActiveChainLink {
  type: 'chain_link';
  descriptor: ChainLinkEffectDescriptor;
  startTime: number;
  durationMs: number;
  completed: boolean;
  segments: Array<{ x: number; y: number }>;
}

type ActiveEffect = ActiveProjectile | ActiveBurst | ActiveScreenFlash | ActiveChainLink;

export class CanvasFXRunner {
  public mode: FXRunnerMode;
  public onFrame?: () => void;
  private activeEffects: ActiveEffect[] = [];
  private queuedTracks: VisualEffectDescriptor[][] = [];
  private animationFrameId: number | null = null;
  private currentPromiseResolve: (() => void) | null = null;
  private isDestroyed = false;

  constructor(options: FXRunnerOptions = {}) {
    this.mode = options.mode ?? 'smooth';
    this.onFrame = options.onFrame;
  }

  public setMode(mode: FXRunnerMode): void {
    this.mode = mode;
  }

  public get isPlaying(): boolean {
    return this.activeEffects.length > 0 || this.queuedTracks.length > 0;
  }

  /**
   * Enqueues visual effects and returns a Promise that resolves when all effects
   * finish rendering. In 'instant' mode, resolves synchronously in 0ms.
   */
  public playEffects(effects: VisualEffectDescriptor[]): Promise<void> {
    if (this.isDestroyed || !effects || effects.length === 0 || this.mode === 'instant') {
      return Promise.resolve();
    }

    if (typeof window === 'undefined' || typeof requestAnimationFrame === 'undefined') {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      // Split effects into sequential waves if projectiles precede bursts
      // Projectiles fly first, bursts trigger upon arrival
      const projectiles = effects.filter((e) => e.type === 'projectile');
      const immediate = effects.filter((e) => e.type !== 'projectile' && e.type !== 'burst');
      const bursts = effects.filter((e) => e.type === 'burst');

      if (projectiles.length > 0) {
        // Wave 1: Projectiles + immediate effects
        this.queuedTracks.push([...projectiles, ...immediate]);
        // Wave 2: Bursts (detonations at impact)
        if (bursts.length > 0) {
          this.queuedTracks.push(bursts);
        }
      } else {
        // All play together in single wave
        this.queuedTracks.push(effects);
      }

      const existingResolve = this.currentPromiseResolve;
      this.currentPromiseResolve = () => {
        if (existingResolve) existingResolve();
        resolve();
      };

      if (this.activeEffects.length === 0) {
        this.advanceTrack();
      }

      if (!this.animationFrameId) {
        this.startLoop();
      }
    });
  }

  public playQueue(effects: VisualEffectDescriptor[]): Promise<void> {
    return this.playEffects(effects);
  }

  private advanceTrack(): void {
    if (this.queuedTracks.length === 0) {
      if (this.currentPromiseResolve) {
        const resolve = this.currentPromiseResolve;
        this.currentPromiseResolve = null;
        resolve();
      }
      return;
    }

    const nextBatch = this.queuedTracks.shift();
    if (!nextBatch || nextBatch.length === 0) {
      this.advanceTrack();
      return;
    }

    const now = performance.now();
    for (const desc of nextBatch) {
      this.activeEffects.push(this.createActiveEffect(desc, now));
    }
  }

  private createActiveEffect(desc: VisualEffectDescriptor, now: number): ActiveEffect {
    switch (desc.type) {
      case 'projectile': {
        const safePath = (desc.path ?? []).filter(
          (p): p is { x: number; y: number; isReflection?: boolean } =>
            Boolean(p && typeof p.x === 'number' && typeof p.y === 'number')
        );
        return {
          type: 'projectile',
          descriptor: { ...desc, path: safePath },
          currentStepIndex: 0,
          progressInStep: 0,
          totalSteps: safePath.length,
          startTime: now,
          completed: safePath.length === 0,
          tailHistory: [],
        };
      }

      case 'burst': {
        const epicenter = desc.epicenter && typeof desc.epicenter.x === 'number' && typeof desc.epicenter.y === 'number'
          ? desc.epicenter
          : { x: 0, y: 0 };
        const particles: ActiveBurst['particles'] = [];
        const radius = desc.radius ?? 1;
        const count = Math.max(8, Math.min(24, Math.floor(radius * 12)));
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.4 - 0.2);
          const speed = (Math.random() * 0.8 + 0.6) * (radius || 1);
          particles.push({
            x: epicenter.x + 0.5,
            y: epicenter.y + 0.5,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: desc.color ?? '#fbbf24',
            size: Math.random() * 3 + 2,
          });
        }
        return {
          type: 'burst',
          descriptor: { ...desc, epicenter, radius },
          startTime: now,
          durationMs: desc.durationMs || 250,
          completed: false,
          particles,
        };
      }

      case 'screen_flash':
        return {
          type: 'screen_flash',
          descriptor: desc,
          startTime: now,
          durationMs: desc.durationMs || 180,
          completed: false,
        };

      case 'chain_link': {
        const from = desc.from && typeof desc.from.x === 'number' && typeof desc.from.y === 'number'
          ? desc.from
          : { x: 0, y: 0 };
        const to = desc.to && typeof desc.to.x === 'number' && typeof desc.to.y === 'number'
          ? desc.to
          : { x: 0, y: 0 };
        // Generate jagged lightning path
        const segments: Array<{ x: number; y: number }> = [];
        const fx = from.x + 0.5;
        const fy = from.y + 0.5;
        const tx = to.x + 0.5;
        const ty = to.y + 0.5;
        const dist = Math.hypot(tx - fx, ty - fy);
        const steps = Math.max(2, Math.floor(dist * 2));
        segments.push({ x: fx, y: fy });
        for (let s = 1; s < steps; s++) {
          const t = s / steps;
          const nx = fx + (tx - fx) * t + (Math.random() - 0.5) * 0.4;
          const ny = fy + (ty - fy) * t + (Math.random() - 0.5) * 0.4;
          segments.push({ x: nx, y: ny });
        }
        segments.push({ x: tx, y: ty });

        return {
          type: 'chain_link',
          descriptor: { ...desc, from, to },
          startTime: now,
          durationMs: desc.durationMs || 150,
          completed: false,
          segments,
        };
      }
    }
  }

  private startLoop(): void {
    const loop = (timestamp: number) => {
      if (this.isDestroyed) return;

      this.update(timestamp);
      if (this.onFrame) {
        this.onFrame();
      }

      if (this.activeEffects.length > 0 || this.queuedTracks.length > 0) {
        this.animationFrameId = requestAnimationFrame(loop);
      } else {
        this.animationFrameId = null;
        if (this.currentPromiseResolve) {
          const resolve = this.currentPromiseResolve;
          this.currentPromiseResolve = null;
          resolve();
        }
      }
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private update(now: number): void {
    for (const ef of this.activeEffects) {
      if (ef.completed) continue;

      const elapsed = now - ef.startTime;

      if (ef.type === 'projectile') {
        const stepDelay = Math.max(10, ef.descriptor.stepDelayMs || 22);
        const totalDuration = stepDelay * Math.max(1, ef.totalSteps);

        if (this.mode === 'retro' || ef.descriptor.travelMode === 'stepped') {
          // Discrete step index jump
          const stepIndex = Math.min(ef.totalSteps - 1, Math.floor(elapsed / stepDelay));
          ef.currentStepIndex = stepIndex;
          ef.progressInStep = 0;
          if (elapsed >= totalDuration) {
            ef.completed = true;
          }
        } else {
          // Smooth sub-tile lerp
          const totalProgress = Math.min(1, elapsed / totalDuration);
          const fractionalStep = totalProgress * (ef.totalSteps - 1);
          ef.currentStepIndex = Math.min(ef.totalSteps - 1, Math.floor(fractionalStep));
          ef.progressInStep = fractionalStep - ef.currentStepIndex;

          const currPt = ef.descriptor.path[ef.currentStepIndex] ?? ef.descriptor.path[0];
          if (!currPt || typeof currPt.x !== 'number' || typeof currPt.y !== 'number') {
            ef.completed = true;
            continue;
          }
          const nextPt = ef.descriptor.path[Math.min(ef.totalSteps - 1, ef.currentStepIndex + 1)] || currPt;
          const nx = typeof nextPt.x === 'number' ? nextPt.x : currPt.x;
          const ny = typeof nextPt.y === 'number' ? nextPt.y : currPt.y;
          const currentWorldX = currPt.x + (nx - currPt.x) * ef.progressInStep;
          const currentWorldY = currPt.y + (ny - currPt.y) * ef.progressInStep;

          ef.tailHistory.unshift({ x: currentWorldX, y: currentWorldY, alpha: 1.0 });
          if (ef.tailHistory.length > 6) {
            ef.tailHistory.pop();
          }
          for (const trail of ef.tailHistory) {
            trail.alpha *= 0.75;
          }

          if (totalProgress >= 1) {
            ef.completed = true;
          }
        }
      } else if (ef.type === 'burst' || ef.type === 'screen_flash' || ef.type === 'chain_link') {
        if (elapsed >= ef.durationMs) {
          ef.completed = true;
        }
      }
    }

    // Filter out completed effects
    const allDone = this.activeEffects.every((e) => e.completed);
    if (allDone) {
      this.activeEffects = [];
      this.advanceTrack();
    }
  }

  /**
   * Renders all active effects atop the dungeon floor and entities.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    _atlas?: SpriteAtlas
  ): void {
    if (this.activeEffects.length === 0) return;

    ctx.save();

    for (const ef of this.activeEffects) {
      if (ef.completed) continue;

      if (ef.type === 'projectile') {
        this.renderProjectile(ctx, ef, camera, cellSize, offsetX, offsetY);
      } else if (ef.type === 'burst') {
        this.renderBurst(ctx, ef, camera, cellSize, offsetX, offsetY);
      } else if (ef.type === 'chain_link') {
        this.renderChainLink(ctx, ef, camera, cellSize, offsetX, offsetY);
      } else if (ef.type === 'screen_flash') {
        this.renderScreenFlash(ctx, ef, offsetX, offsetY);
      }
    }

    ctx.restore();
  }

  private renderProjectile(
    ctx: CanvasRenderingContext2D,
    ef: ActiveProjectile,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    const path = ef.descriptor.path;
    if (!path || path.length === 0) return;

    let worldX: number;
    let worldY: number;

    if (this.mode === 'retro' || ef.descriptor.travelMode === 'stepped') {
      const pt = path[ef.currentStepIndex] || path[path.length - 1];
      if (!pt || typeof pt.x !== 'number' || typeof pt.y !== 'number') return;
      worldX = pt.x + 0.5;
      worldY = pt.y + 0.5;
    } else {
      const p1 = path[ef.currentStepIndex] || path[path.length - 1];
      if (!p1 || typeof p1.x !== 'number' || typeof p1.y !== 'number') return;
      const p2 = path[Math.min(path.length - 1, ef.currentStepIndex + 1)] || p1;
      const p2x = typeof p2.x === 'number' ? p2.x : p1.x;
      const p2y = typeof p2.y === 'number' ? p2.y : p1.y;
      worldX = (p1.x + (p2x - p1.x) * ef.progressInStep) + 0.5;
      worldY = (p1.y + (p2y - p1.y) * ef.progressInStep) + 0.5;

      // Draw particle trail
      for (let i = 0; i < ef.tailHistory.length; i++) {
        const t = ef.tailHistory[i];
        const tx = offsetX + (t.x + 0.5 - camera.startX) * cellSize;
        const ty = offsetY + (t.y + 0.5 - camera.startY) * cellSize;
        const trailRadius = Math.max(1.5, (cellSize * 0.18) * (1 - i / ef.tailHistory.length));
        ctx.fillStyle = ef.descriptor.color;
        ctx.globalAlpha = Math.max(0, t.alpha * 0.6);
        ctx.beginPath();
        ctx.arc(tx, ty, trailRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const screenX = offsetX + (worldX - camera.startX) * cellSize;
    const screenY = offsetY + (worldY - camera.startY) * cellSize;

    // Draw core projectile glow & orb
    ctx.globalAlpha = 1.0;
    const radius = cellSize * 0.26;

    // Outer glow
    ctx.fillStyle = ef.descriptor.color;
    ctx.shadowColor = ef.descriptor.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // If current tile is a wall ricochet reflection, draw energetic spark ring
    const currentPt = path[ef.currentStepIndex];
    if (currentPt?.isReflection) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(screenX, screenY, radius * 1.8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private renderBurst(
    ctx: CanvasRenderingContext2D,
    ef: ActiveBurst,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    const elapsed = performance.now() - ef.startTime;
    const progress = Math.min(1, elapsed / ef.durationMs);
    const alpha = Math.max(0, 1 - progress);

    if (!ef.descriptor.epicenter || typeof ef.descriptor.epicenter.x !== 'number' || typeof ef.descriptor.epicenter.y !== 'number') {
      return;
    }

    const epicenterX = offsetX + (ef.descriptor.epicenter.x + 0.5 - camera.startX) * cellSize;
    const epicenterY = offsetY + (ef.descriptor.epicenter.y + 0.5 - camera.startY) * cellSize;

    const maxRadiusPx = (ef.descriptor.radius + 0.5) * cellSize;
    const currentRadiusPx = maxRadiusPx * Math.sin(progress * Math.PI * 0.5);

    // Shockwave expansion ring
    ctx.strokeStyle = ef.descriptor.color;
    ctx.lineWidth = Math.max(1, 4 * alpha);
    ctx.globalAlpha = alpha * 0.9;
    ctx.beginPath();
    ctx.arc(epicenterX, epicenterY, currentRadiusPx, 0, Math.PI * 2);
    ctx.stroke();

    // Inner fiery / energetic core flash
    if (progress < 0.6) {
      const coreAlpha = (0.6 - progress) / 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = coreAlpha * 0.8;
      ctx.beginPath();
      ctx.arc(epicenterX, epicenterY, currentRadiusPx * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }

    // Radiating particles
    for (const p of ef.particles) {
      const px = offsetX + (p.x + p.vx * progress * (ef.descriptor.radius + 0.5) - camera.startX) * cellSize;
      const py = offsetY + (p.y + p.vy * progress * (ef.descriptor.radius + 0.5) - camera.startY) * cellSize;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderChainLink(
    ctx: CanvasRenderingContext2D,
    ef: ActiveChainLink,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    const elapsed = performance.now() - ef.startTime;
    const progress = Math.min(1, elapsed / ef.durationMs);
    const alpha = Math.max(0, 1 - progress);

    if (ef.segments.length < 2) return;

    ctx.strokeStyle = ef.descriptor.color;
    ctx.lineWidth = Math.max(1, 3 * alpha);
    ctx.shadowColor = ef.descriptor.color;
    ctx.shadowBlur = 8;
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    const first = ef.segments[0];
    if (!first || typeof first.x !== 'number' || typeof first.y !== 'number') return;
    const sx = offsetX + (first.x - camera.startX) * cellSize;
    const sy = offsetY + (first.y - camera.startY) * cellSize;
    ctx.moveTo(sx, sy);

    for (let i = 1; i < ef.segments.length; i++) {
      const seg = ef.segments[i];
      if (!seg || typeof seg.x !== 'number' || typeof seg.y !== 'number') continue;
      const px = offsetX + (seg.x - camera.startX) * cellSize;
      const py = offsetY + (seg.y - camera.startY) * cellSize;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // White electric core highlight
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, 1.5 * alpha);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let i = 1; i < ef.segments.length; i++) {
      const seg = ef.segments[i];
      const px = offsetX + (seg.x - camera.startX) * cellSize;
      const py = offsetY + (seg.y - camera.startY) * cellSize;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  private renderScreenFlash(
    ctx: CanvasRenderingContext2D,
    ef: ActiveScreenFlash,
    _offsetX: number,
    _offsetY: number
  ): void {
    const elapsed = performance.now() - ef.startTime;
    const progress = Math.min(1, elapsed / ef.durationMs);
    const alpha = Math.max(0, 0.4 * (1 - progress));

    ctx.fillStyle = ef.descriptor.color;
    ctx.globalAlpha = alpha;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.activeEffects = [];
    this.queuedTracks = [];
    if (this.currentPromiseResolve) {
      const resolve = this.currentPromiseResolve;
      this.currentPromiseResolve = null;
      resolve();
    }
  }

  public cleanup(): void {
    this.destroy();
  }
}
