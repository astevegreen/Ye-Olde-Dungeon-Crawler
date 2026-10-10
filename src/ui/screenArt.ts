import type { ScreenPainting, ScreenScene } from '../engine';

/** The fastest the painting repaints, ms: its pixel-art motion reads the same at 30 a second. */
const FRAME_MS = 33;

export interface ScreenBackdropOptions {
  /** False holds the painting still at its first frame (Reduce motion). */
  motion: () => boolean;
  /** The narrowest the host's panel may be: a calm box narrower than this leaves it centred. */
  minPanel: number;
}

/**
 * A pack's painted screen (`manifest.screenArt`) behind a full-window title or dialog: a
 * canvas covering the window, the small painting scaled up a whole number of times (nearest
 * neighbour), and the host's panel moved into the painting's calm box when that box is wide
 * enough. Its loop repeats; resizing paints the scene again at the new size. Ambient (§4): it
 * never holds input, and stops once its host leaves the page or hides.
 */
export class ScreenBackdrop {
  private canvas: HTMLCanvasElement | null = null;
  private scene: ScreenScene | null = null;
  private painting: ScreenPainting | null = null;
  private img: ImageData | null = null;
  private raf = 0;
  private lastPaint = -Infinity;
  private readonly started = typeof performance !== 'undefined' ? performance.now() : 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly options: ScreenBackdropOptions
  ) {}

  /** Paints `scene` behind the host; without one the host keeps its own look. */
  public show(scene: ScreenScene | undefined): void {
    if (!scene || typeof window === 'undefined' || typeof document === 'undefined') {
      this.hide();
      return;
    }
    if (scene !== this.scene) this.painting = null;
    this.scene = scene;
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'screen-art';
      this.canvas.setAttribute('aria-hidden', 'true');
      window.addEventListener('resize', this.onResize);
    }
    if (this.host.firstChild !== this.canvas) this.host.prepend(this.canvas);
    this.host.classList.add('has-screen-art');
    this.layout();
    this.start();
  }

  /** Takes the painting away and stops its loop. */
  public hide(): void {
    this.stop();
    this.scene = null;
    this.painting = null;
    if (!this.canvas) return;
    window.removeEventListener('resize', this.onResize);
    this.canvas.remove();
    this.canvas = null;
    this.host.classList.remove('has-screen-art', 'is-calm');
  }

  private readonly onResize = (): void => {
    this.painting = null;
    this.layout();
    if (!this.raf) this.paint(0);
  };

  /** Sizes the canvas to the window and moves the panel into the calm box when it fits. */
  private layout(): void {
    const canvas = this.canvas;
    if (!canvas || !this.scene) return;
    const p = (this.painting ??= this.scene.open(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight)));
    this.img = null;
    canvas.width = p.width;
    canvas.height = p.height;
    canvas.style.width = `${p.width * p.scale}px`;
    canvas.style.height = `${p.height * p.scale}px`;
    const calm = p.calm.w >= this.options.minPanel;
    this.host.classList.toggle('is-calm', calm);
    const style = this.host.style;
    style.setProperty('--calm-x', `${p.calm.x}px`);
    style.setProperty('--calm-y', `${p.calm.y}px`);
    style.setProperty('--calm-w', `${p.calm.w}px`);
    style.setProperty('--calm-h', `${p.calm.h}px`);
    style.setProperty('--art-text-bottom', `${p.text.y + p.text.h}px`);
  }

  private start(): void {
    this.stop();
    this.paint(0);
    if (!this.options.motion() || typeof requestAnimationFrame !== 'function') return;
    const tick = (now: number): void => {
      this.raf = 0;
      if (!this.canvas?.isConnected || this.host.style.display === 'none') return;
      if (now - this.lastPaint >= FRAME_MS) {
        this.lastPaint = now;
        this.paint(now - this.started);
      }
      if (this.options.motion()) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stop(): void {
    if (this.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private paint(t: number): void {
    const p = this.painting;
    const ctx = this.canvas?.getContext?.('2d');
    if (!p || !ctx) return;
    const img = (this.img ??= ctx.createImageData(p.width, p.height));
    img.data.set(p.paint(t).subarray(0, img.data.length));
    ctx.putImageData(img, 0, 0);
  }
}
