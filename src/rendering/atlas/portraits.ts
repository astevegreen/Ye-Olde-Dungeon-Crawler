import type { PixelSprite } from '../../engine';

/** Portraits kept baked, by key and size; the least recently shown past this are dropped. */
const KEEP = 8;

type Defer = (fn: () => void) => void;

/**
 * The pack's portraits (`manifest.portraits`), baked at the size a window shows them. A
 * portrait frame takes 60-120 ms at 192 px, so frame 0 bakes when the window opens and the
 * others one per task after it (`warm`); until a frame is ready the portrait holds frame 0.
 */
export class PortraitStore {
  private readonly baked = new Map<string, Array<Uint8ClampedArray | undefined>>();
  private readonly warming = new Set<string>();

  constructor(
    private readonly sprites: Readonly<Record<string, PixelSprite>> = {},
    private readonly defer: Defer = (fn) => setTimeout(fn, 0)
  ) {}

  /** Whether the pack paints any portrait. */
  public get any(): boolean {
    return Object.keys(this.sprites).length > 0;
  }

  /** How many idle frames `key`'s portrait has; 0 when the pack has none for it. */
  public frameCount(key: string): number {
    const sprite = this.sprites[key];
    return sprite ? Math.max(1, sprite.frames ?? 1) : 0;
  }

  /** `key`'s pixels at `size`, `frame` once it is baked, else frame 0 (baked now); null without a portrait. */
  public pixels(key: string, size: number, frame: number): Uint8ClampedArray | null {
    const sprite = this.sprites[key];
    if (!sprite) return null;
    const frames = this.framesOf(key, size);
    frames[0] ??= sprite.render(0, size);
    return frames[frame] ?? frames[0];
  }

  /** Bakes the rest of `key`'s frames at `size`, one per task, so a window never waits on them. */
  public warm(key: string, size: number): void {
    const sprite = this.sprites[key];
    const id = `${key}@${size}`;
    if (!sprite || this.warming.has(id)) return;
    this.warming.add(id);
    const n = this.frameCount(key);
    const next = (): void => {
      // a portrait dropped from the cache stops warming; shown again, it warms again
      const frames = this.baked.get(id);
      let missing = 1;
      while (frames && missing < n && frames[missing]) missing++;
      if (!frames || missing >= n) {
        this.warming.delete(id);
        return;
      }
      frames[missing] = sprite.render(missing, size);
      this.defer(next);
    };
    this.defer(next);
  }

  private framesOf(key: string, size: number): Array<Uint8ClampedArray | undefined> {
    const id = `${key}@${size}`;
    const frames = this.baked.get(id) ?? [];
    this.baked.delete(id);
    this.baked.set(id, frames);
    for (const old of this.baked.keys()) {
      if (this.baked.size <= KEEP) break;
      this.baked.delete(old);
    }
    return frames;
  }
}
