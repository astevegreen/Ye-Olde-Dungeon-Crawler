import type {
  VisualEffectDescriptor,
  ProjectileEffectDescriptor,
  BurstEffectDescriptor,
  ScreenFlashEffectDescriptor,
  ChainLinkEffectDescriptor,
  FxSurface,
  SpellFxArt,
  SpellFxCatalog,
} from '../engine';
import { flightRecorder, isTacticalEffect } from '../engine';
import type { Camera } from './camera';
import type { SpriteAtlas } from './atlas/sprite-atlas';

export type FXRunnerMode = 'retro' | 'smooth' | 'instant';

/** How a melee blow went: landed, landed critically, or missed. */
export type MeleeFxKind = 'hit' | 'crit' | 'miss';

export interface FXRunnerOptions {
  mode?: FXRunnerMode;
  onFrame?: () => void;
  /** The pack's drawn effects, read as each effect starts; without them every effect draws as generic shapes. */
  art?: () => SpellFxCatalog | undefined;
}

type Cell = { x: number; y: number };

/** One straight stretch of a flight, between the caster, the wall bounces and the end. */
interface FlightLeg {
  from: Cell;
  to: Cell;
  /** Path steps it takes: its share of the flight time. */
  steps: number;
}

interface ActiveProjectile {
  type: 'projectile';
  descriptor: ProjectileEffectDescriptor;
  currentStepIndex: number;
  progressInStep: number; // 0..1 for smooth interpolation
  totalSteps: number;
  /** 0..1 over the whole flight, whatever the travel mode. */
  progress: number;
  startTime: number;
  completed: boolean;
  tailHistory: Array<{ x: number; y: number; alpha: number }>;
  art?: SpellFxArt;
  legs: FlightLeg[];
  /** It lands with the art's impact; false when a burst bursts where it lands and draws one there. */
  impact: boolean;
}

interface ActiveBurst {
  type: 'burst';
  descriptor: BurstEffectDescriptor;
  startTime: number;
  durationMs: number;
  completed: boolean;
  /** The art draws the blast, so only the ring showing its reach is drawn here. */
  drawn: boolean;
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
  art?: SpellFxArt;
}

/** Pack art playing on its own clock: an impact, a self cast or a melee blow. */
interface ActiveDrawn {
  type: 'drawn';
  /** Draws at progress p, in world pixels with tiles `cs` wide. */
  draw: (ctx: FxSurface, cs: number, p: number) => void;
  startTime: number;
  durationMs: number;
  completed: boolean;
}

/** Holds a tactical batch while the start of an impact plays on the ambient list. */
interface ActiveHold {
  type: 'hold';
  startTime: number;
  durationMs: number;
  completed: boolean;
}

type ActiveEffect = ActiveProjectile | ActiveBurst | ActiveScreenFlash | ActiveChainLink | ActiveDrawn | ActiveHold;

/**
 * Global spell-FX pacing knob (gameplay note: animations read as too fast to
 * follow the mechanics). Applied uniformly to every effect's step delay /
 * duration *after* the descriptor's own fallback resolves, so a content-
 * authored per-spell override (`spell.visual.stepDelayMs`/`durationMs` in
 * `spellPipeline.ts`) gets slowed too, not just the built-in defaults.
 */
const FX_SPEED_MULTIPLIER = 1.75;

/**
 * How long a drawn impact holds input after a flight lands (owner: "No longer than today").
 * The rest of the impact plays on as ambient.
 */
const IMPACT_HOLD_MS = 250;

/** World pixels of a tile's centre. */
const centre = (cell: Cell, cs: number): [number, number] => [(cell.x + 0.5) * cs, (cell.y + 0.5) * cs];

/** Splits a flight at its wall bounces, so drawn art follows each straight stretch. */
function flightLegs(origin: Cell | undefined, path: ProjectileEffectDescriptor['path']): FlightLeg[] {
  if (path.length === 0) return [];
  const legs: FlightLeg[] = [];
  let from: Cell = origin ?? path[0];
  let steps = 0;
  for (const pt of path) {
    steps++;
    if (pt.isReflection) {
      legs.push({ from, to: pt, steps });
      from = pt;
      steps = 0;
    }
  }
  const last = path[path.length - 1];
  if (steps > 0 || legs.length === 0) legs.push({ from, to: last, steps: Math.max(1, steps) });
  return legs;
}

export class CanvasFXRunner {
  public mode: FXRunnerMode;
  public onFrame?: () => void;
  /** The tactical track's current batch; input waits for it (§4). */
  private activeEffects: ActiveEffect[] = [];
  /** Effects that hold nothing: ambient batches, the tail of impacts, melee blows. */
  private ambientEffects: ActiveEffect[] = [];
  private queuedTracks: VisualEffectDescriptor[][] = [];
  private animationFrameId: number | null = null;
  private currentPromiseResolve: (() => void) | null = null;
  private isDestroyed = false;
  private readonly art: () => SpellFxCatalog | undefined;
  /** Flights that end where a burst of their batch goes off: the burst draws their impact. */
  private readonly landsInBurst = new WeakSet<ProjectileEffectDescriptor>();

  constructor(options: FXRunnerOptions = {}) {
    this.mode = options.mode ?? 'smooth';
    this.onFrame = options.onFrame;
    this.art = options.art ?? (() => undefined);
  }

  public setMode(mode: FXRunnerMode): void {
    this.mode = mode;
  }

  public get isPlaying(): boolean {
    return this.activeEffects.length > 0 || this.queuedTracks.length > 0;
  }

  private get canPlay(): boolean {
    return !this.isDestroyed && this.mode !== 'instant' && typeof window !== 'undefined' && typeof requestAnimationFrame !== 'undefined';
  }

  /**
   * Enqueues visual effects and returns a Promise that resolves when all effects
   * finish rendering. In 'instant' mode, resolves synchronously in 0ms.
   */
  public playEffects(effects: VisualEffectDescriptor[]): Promise<void> {
    if (!effects || effects.length === 0 || !this.canPlay) {
      return Promise.resolve();
    }
    this.markLandings(effects);

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

      this.ensureLoop();
    });
  }

  /**
   * Starts ambient effects without gating anything (ARCHITECTURE.md §4). They play on their
   * own list rather than the track queue, so they never join the promise chain that
   * `playEffects` resolves — a caller awaiting tactical playback is not held up by
   * decoration still fading out.
   */
  public playAmbient(effects: VisualEffectDescriptor[]): void {
    if (!effects || effects.length === 0 || !this.canPlay) return;
    this.markLandings(effects);
    const now = performance.now();
    for (const desc of effects) {
      this.ambientEffects.push(this.createActiveEffect(desc, now));
    }
    this.ensureLoop();
  }

  /**
   * Plays a mixed batch: tactical effects are awaited (callers gate input on them),
   * ambient effects start at once and are not awaited.
   */
  public playQueue(effects: VisualEffectDescriptor[]): Promise<void> {
    if (!effects || effects.length === 0) return Promise.resolve();
    this.markLandings(effects);
    const tactical = effects.filter(isTacticalEffect);
    const ambient = effects.filter((e) => !isTacticalEffect(e));
    this.playAmbient(ambient);
    return tactical.length > 0 ? this.playEffects(tactical) : Promise.resolve();
  }

  /**
   * A melee blow on `at`, struck from the direction `dir` points. Ambient: it never holds
   * input. Draws nothing when the pack has no melee art.
   */
  public playMelee(kind: MeleeFxKind, at: Cell, dir: readonly [number, number]): void {
    const melee = this.art()?.melee;
    if (!melee || !this.canPlay) return;
    const strike = melee[kind];
    this.spawnDrawn((ctx, cs, p) => {
      const [x, y] = centre(at, cs);
      strike(ctx, x, y, p, cs, dir);
    }, melee.ms);
    this.ensureLoop();
  }

  /** Notes each flight that lands on a burst's epicentre (a fireball), so it skips its own impact. */
  private markLandings(effects: VisualEffectDescriptor[]): void {
    const epicentres = new Set<string>();
    for (const e of effects) {
      if (e.type === 'burst' && e.epicenter) epicentres.add(`${e.epicenter.x},${e.epicenter.y}`);
    }
    if (epicentres.size === 0) return;
    for (const e of effects) {
      const last = e.type === 'projectile' ? e.path?.[e.path.length - 1] : undefined;
      if (e.type === 'projectile' && last && epicentres.has(`${last.x},${last.y}`)) this.landsInBurst.add(e);
    }
  }

  private ensureLoop(): void {
    if (!this.animationFrameId) {
      this.startLoop();
    }
  }

  private spawnDrawn(draw: ActiveDrawn['draw'], durationMs: number): void {
    this.ambientEffects.push({ type: 'drawn', draw, startTime: performance.now(), durationMs, completed: false });
  }

  /** The art's impact on `at`: the first `holdMs` holds the track when `hold`, the rest plays as ambient. */
  private spawnImpact(art: SpellFxArt, at: Cell, hold: boolean): void {
    const impact = art.impact;
    if (!impact) return;
    this.spawnDrawn((ctx, cs, p) => {
      const [x, y] = centre(at, cs);
      impact(ctx, x, y, p, cs);
    }, art.msImpact);
    if (hold) {
      this.activeEffects.push({ type: 'hold', startTime: performance.now(), durationMs: Math.min(IMPACT_HOLD_MS, art.msImpact), completed: false });
    }
  }

  /** The pack's art for an effect, when it draws one. */
  private artFor(fx: string | undefined): SpellFxArt | undefined {
    return fx ? this.art()?.elements[fx] : undefined;
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
        const origin = desc.origin && typeof desc.origin.x === 'number' && typeof desc.origin.y === 'number' ? desc.origin : undefined;
        return {
          type: 'projectile',
          descriptor: { ...desc, path: safePath },
          currentStepIndex: 0,
          progressInStep: 0,
          totalSteps: safePath.length,
          progress: 0,
          startTime: now,
          completed: safePath.length === 0,
          tailHistory: [],
          art: this.artFor(desc.fx),
          legs: flightLegs(origin, safePath),
          impact: !this.landsInBurst.has(desc),
        };
      }

      case 'burst': {
        const epicenter = desc.epicenter && typeof desc.epicenter.x === 'number' && typeof desc.epicenter.y === 'number'
          ? desc.epicenter
          : { x: 0, y: 0 };
        const radius = desc.radius ?? 1;
        const art = this.artFor(desc.fx);
        // A self cast (an aura burst) draws the art's own self cast when it has one.
        const self = desc.style === 'aura' ? art?.self : undefined;
        const draw = self ?? art?.impact;
        if (art && draw) {
          this.spawnDrawn((ctx, cs, p) => {
            const [x, y] = centre(epicenter, cs);
            draw(ctx, x, y, p, cs);
          }, self ? (art.msSelf ?? art.msImpact) : art.msImpact);
        }
        const particles: ActiveBurst['particles'] = [];
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
          durationMs: (desc.durationMs || 250) * FX_SPEED_MULTIPLIER,
          completed: false,
          drawn: Boolean(art && draw),
          particles,
        };
      }

      case 'screen_flash':
        return {
          type: 'screen_flash',
          descriptor: desc,
          startTime: now,
          durationMs: (desc.durationMs || 180) * FX_SPEED_MULTIPLIER,
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

        const art = this.artFor(desc.fx);
        return {
          type: 'chain_link',
          descriptor: { ...desc, from, to },
          startTime: now,
          durationMs: (desc.durationMs || 150) * FX_SPEED_MULTIPLIER,
          completed: false,
          segments,
          art: art?.bolt ? art : undefined,
        };
      }
    }
  }

  private startLoop(): void {
    const loop = (timestamp: number) => {
      if (this.isDestroyed) return;

      // One bad frame must not end the loop with its promise unsettled, which left input
      // locked for the session (R-rend-8): record it, drop what was playing, finish cleanly.
      try {
        this.update(timestamp);
        if (this.onFrame) {
          this.onFrame();
        }
      } catch (err) {
        flightRecorder.recordError(err instanceof Error ? err : new Error(String(err)), { source: 'fxRunner frame' });
        this.activeEffects = [];
        this.ambientEffects = [];
        this.queuedTracks = [];
      }

      if (this.activeEffects.length > 0 || this.queuedTracks.length > 0 || this.ambientEffects.length > 0) {
        this.animationFrameId = requestAnimationFrame(loop);
      } else {
        this.animationFrameId = null;
      }
      if (this.activeEffects.length === 0 && this.queuedTracks.length === 0 && this.currentPromiseResolve) {
        const resolve = this.currentPromiseResolve;
        this.currentPromiseResolve = null;
        resolve();
      }
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  private update(now: number): void {
    for (const ef of [...this.activeEffects]) this.step(ef, now, true);
    for (const ef of [...this.ambientEffects]) this.step(ef, now, false);
    this.ambientEffects = this.ambientEffects.filter((e) => !e.completed);

    const allDone = this.activeEffects.every((e) => e.completed);
    if (allDone) {
      this.activeEffects = [];
      this.advanceTrack();
    }
  }

  /** Advances one effect; one that lands may start its impact (`tactical`: it holds the track). */
  private step(ef: ActiveEffect, now: number, tactical: boolean): void {
    if (ef.completed) return;

    const elapsed = now - ef.startTime;

    if (ef.type === 'projectile') {
      const stepDelay = Math.max(10, (ef.descriptor.stepDelayMs || 22) * FX_SPEED_MULTIPLIER);
      const totalDuration = stepDelay * Math.max(1, ef.totalSteps);
      ef.progress = Math.min(1, elapsed / totalDuration);

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
        const fractionalStep = ef.progress * (ef.totalSteps - 1);
        ef.currentStepIndex = Math.min(ef.totalSteps - 1, Math.floor(fractionalStep));
        ef.progressInStep = fractionalStep - ef.currentStepIndex;

        const currPt = ef.descriptor.path[ef.currentStepIndex] ?? ef.descriptor.path[0];
        if (!currPt || typeof currPt.x !== 'number' || typeof currPt.y !== 'number') {
          ef.completed = true;
          return;
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

        if (ef.progress >= 1) {
          ef.completed = true;
        }
      }
      if (ef.completed && ef.art && ef.impact) {
        const last = ef.descriptor.path[ef.descriptor.path.length - 1];
        if (last) this.spawnImpact(ef.art, last, tactical);
      }
    } else if (ef.type === 'chain_link') {
      if (elapsed >= ef.durationMs) {
        ef.completed = true;
        if (ef.art) this.spawnImpact(ef.art, ef.descriptor.to, false);
      }
    } else if (elapsed >= ef.durationMs) {
      ef.completed = true;
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
    if (this.activeEffects.length === 0 && this.ambientEffects.length === 0) return;

    ctx.save();

    const now = performance.now();
    for (const ef of [...this.ambientEffects, ...this.activeEffects]) {
      if (ef.completed) continue;

      if (ef.type === 'projectile') {
        if (ef.art?.bolt) {
          this.renderBolt(ctx, ef, ef.art.bolt, camera, cellSize, offsetX, offsetY);
        } else {
          this.renderProjectile(ctx, ef, camera, cellSize, offsetX, offsetY);
        }
      } else if (ef.type === 'burst') {
        this.renderBurst(ctx, ef, camera, cellSize, offsetX, offsetY);
      } else if (ef.type === 'chain_link') {
        if (ef.art?.bolt) {
          const bolt = ef.art.bolt;
          const p = Math.min(1, (now - ef.startTime) / ef.durationMs);
          const { from, to } = ef.descriptor;
          this.drawArt(ctx, camera, cellSize, offsetX, offsetY, (s) => {
            const [x0, y0] = centre(from, cellSize);
            const [x1, y1] = centre(to, cellSize);
            bolt(s, x0, y0, x1, y1, p, cellSize);
          });
        } else {
          this.renderChainLink(ctx, ef, camera, cellSize, offsetX, offsetY);
        }
      } else if (ef.type === 'screen_flash') {
        this.renderScreenFlash(ctx, ef, offsetX, offsetY);
      } else if (ef.type === 'drawn') {
        const p = Math.min(1, (now - ef.startTime) / ef.durationMs);
        this.drawArt(ctx, camera, cellSize, offsetX, offsetY, (s) => ef.draw(s, cellSize, p));
      }
    }

    ctx.restore();
  }

  /**
   * Runs pack art with the context translated to world pixels: the art seeds and snaps on
   * absolute positions, so in screen pixels it would shimmer as the camera scrolls.
   */
  private drawArt(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    draw: (surface: FxSurface) => void
  ): void {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;
    ctx.translate(offsetX - camera.startX * cellSize, offsetY - camera.startY * cellSize);
    draw(ctx);
    ctx.restore();
  }

  /** The art's bolt along the leg of the flight it is on. */
  private renderBolt(
    ctx: CanvasRenderingContext2D,
    ef: ActiveProjectile,
    bolt: NonNullable<SpellFxArt['bolt']>,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    const total = ef.legs.reduce((sum, leg) => sum + leg.steps, 0);
    if (total === 0) return;
    let at = ef.progress * total;
    let leg = ef.legs[ef.legs.length - 1];
    for (const l of ef.legs) {
      if (at <= l.steps) {
        leg = l;
        break;
      }
      at -= l.steps;
    }
    const p = Math.max(0, Math.min(1, at / leg.steps));
    this.drawArt(ctx, camera, cellSize, offsetX, offsetY, (s) => {
      const [x0, y0] = centre(leg.from, cellSize);
      const [x1, y1] = centre(leg.to, cellSize);
      bolt(s, x0, y0, x1, y1, p, cellSize);
    });
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
    // With art, a self cast draws nothing more, and a blast only the ring that shows its reach.
    if (ef.drawn && (ef.descriptor.style === 'aura' || ef.descriptor.radius <= 0)) return;

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
    if (ef.drawn) return;

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
    this.ambientEffects = [];
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
