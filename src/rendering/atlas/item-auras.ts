import type { ItemAuraArt } from '../../engine';
import { IDLE_FRAME_MS, idleFrame } from './idle-frames';

/** The longest aura loop kept. */
const MAX_AURA_FRAMES = 16;

/** One sprite's aura in one family: its frames side by side on a strip, each baked on first draw. */
interface AuraStrip {
  strip: HTMLCanvasElement;
  baked: boolean[];
}

/**
 * The pack's item auras (`ItemAuraArt`), baked per sprite and family from the item's own
 * pixels. Aura frame `f` wraps the item's idle frame at the same step, so an idling item
 * keeps its own motion inside its aura.
 */
export class ItemAuraStrips {
  public readonly frames: number;
  private readonly tones: ReadonlySet<string>;
  private readonly strips = new Map<string, AuraStrip>();
  /** The item's pixels per sprite and idle frame, read once and shared by every family. */
  private readonly items = new Map<string, Uint8ClampedArray | null>();

  constructor(
    private readonly art: ItemAuraArt,
    private readonly cell: number,
    /** A sprite's own pixels in one idle frame, `cell` square; null when it has none. */
    private readonly itemPixels: (key: string, frame: number) => Uint8ClampedArray | null,
    private readonly itemFrames: (key: string) => number
  ) {
    this.frames = Math.max(1, Math.min(MAX_AURA_FRAMES, Math.floor(art.frames)));
    this.tones = new Set(art.tones);
  }

  /** Whether the pack draws an aura for `tone`. */
  public has(tone: string | null | undefined): tone is string {
    return !!tone && this.tones.has(tone);
  }

  /** Draws `key` in `tone`'s aura at `frame` (wrapped); false when it could not be baked. */
  public draw(ctx: CanvasRenderingContext2D, key: string, tone: string, dx: number, dy: number, dSize: number, frame: number): boolean {
    const f = ((Math.floor(frame) % this.frames) + this.frames) % this.frames;
    const strip = this.bake(key, tone, f);
    if (!strip) return false;
    ctx.drawImage(strip, f * this.cell, 0, this.cell, this.cell, dx, dy, dSize, dSize);
    return true;
  }

  private bake(key: string, tone: string, f: number): HTMLCanvasElement | null {
    const id = `${key}|${tone}`;
    let aura = this.strips.get(id);
    if (!aura) {
      const strip = document.createElement('canvas');
      strip.width = this.cell * this.frames;
      strip.height = this.cell;
      aura = { strip, baked: [] };
      this.strips.set(id, aura);
    }
    if (aura.baked[f]) return aura.strip;
    const ctx = aura.strip.getContext('2d');
    const item = this.item(key, idleFrame(f * IDLE_FRAME_MS, this.itemFrames(key)));
    if (!ctx || !item) return null;
    const img = ctx.createImageData(this.cell, this.cell);
    img.data.set(this.art.render(item, this.cell, tone, f).subarray(0, img.data.length));
    ctx.putImageData(img, f * this.cell, 0);
    aura.baked[f] = true;
    return aura.strip;
  }

  private item(key: string, frame: number): Uint8ClampedArray | null {
    const id = `${key}|${frame}`;
    if (!this.items.has(id)) this.items.set(id, this.itemPixels(key, frame));
    return this.items.get(id) ?? null;
  }
}
