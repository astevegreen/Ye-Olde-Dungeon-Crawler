/** How long one idle frame shows, in ms: about four a second. */
export const IDLE_FRAME_MS = 260;

const SEQUENCES: Record<number, readonly number[]> = {
  2: [0, 1],
  3: [0, 1, 2, 1],
  4: [0, 1, 2, 3],
};

/**
 * The idle frame a sprite with `frames` frames shows at `now` (ms): four run 0-1-2-3, three
 * go back and forth 0-1-2-1, two alternate, and a longer loop (an item's aura) runs straight
 * through. `phase` offsets whole steps, so a room of the same creature never breathes in step
 * while every sprite still turns over on one tick.
 */
export function idleFrame(now: number, frames: number, phase = 0): number {
  if (frames <= 1) return 0;
  const step = Math.floor(now / IDLE_FRAME_MS) + Math.floor(phase);
  const length = frames > 4 ? frames : SEQUENCES[frames].length;
  const at = ((step % length) + length) % length;
  return frames > 4 ? at : SEQUENCES[frames][at];
}

/** A small stable number from an id, to phase that sprite's idle loop. */
export function idlePhase(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % 4;
}

interface TickTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  requestAnimationFrame(fn: () => void): unknown;
}

/**
 * Redraws the map when the next idle frame turns over, once per request. Ambient, never
 * tactical (§4): it only calls the redraw and holds no input. Waiting on an animation frame
 * pauses it while the page is hidden.
 */
export class IdleTicker {
  private pending = false;
  private stopped = false;

  constructor(
    private readonly redraw: () => void,
    private readonly timers: TickTimers | null = typeof requestAnimationFrame === 'function'
      ? { setTimeout: (fn, ms) => setTimeout(fn, ms), requestAnimationFrame: (fn) => requestAnimationFrame(fn) }
      : null
  ) {}

  /** Call after a draw that showed an idle sprite; a request while one waits does nothing. */
  public request(now: number): void {
    const timers = this.timers;
    if (this.pending || this.stopped || !timers) return;
    this.pending = true;
    timers.setTimeout(() => {
      timers.requestAnimationFrame(() => {
        this.pending = false;
        if (!this.stopped) this.redraw();
      });
    }, IDLE_FRAME_MS - (now % IDLE_FRAME_MS));
  }

  /** No redraw after this, for a renderer being torn down. */
  public stop(): void {
    this.stopped = true;
  }
}

/**
 * Keeps idling icons turning over: DOM canvases a menu painted once (an item in its aura).
 * Each tick repaints the ones still on the page, which watch again while they idle, and
 * forgets the rest, so a closed menu's icons go with it. Ambient, as `IdleTicker`.
 */
export class IdleIcons<T> {
  private watched = new Map<HTMLCanvasElement, T>();
  private readonly ticker: IdleTicker;

  constructor(
    private readonly paint: (canvas: HTMLCanvasElement, subject: T) => void,
    timers?: TickTimers | null
  ) {
    this.ticker = new IdleTicker(() => this.tick(), timers);
  }

  /** Repaint `canvas` at the next idle frame, if it is still on the page then. */
  public watch(canvas: HTMLCanvasElement, subject: T, now: number): void {
    this.watched.set(canvas, subject);
    this.ticker.request(now);
  }

  private tick(): void {
    const due = this.watched;
    this.watched = new Map();
    for (const [canvas, subject] of due) if (canvas.isConnected) this.paint(canvas, subject);
  }

  /** No repaint after this, for a renderer being torn down. */
  public stop(): void {
    this.ticker.stop();
    this.watched.clear();
  }
}
