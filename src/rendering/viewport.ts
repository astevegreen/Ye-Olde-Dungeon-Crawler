import { setCanvasTextScale } from './theme';

export interface ViewportConfig {
  virtualWidth?: number;
  virtualHeight?: number;
  integerScale?: boolean;
  minScale?: number;
  maxScale?: number;
}

/**
 * DOM ids of every bar mounted around the canvas whose real rendered height must be
 * subtracted from the available space before letterboxing the canvas. Missing an
 * entry here is exactly the bug this list exists to prevent: the canvas gets sized
 * as if that bar weren't there, so the actual stack (this bar + canvas + everything
 * else) overflows the viewport and `body { overflow: hidden }` clips it silently.
 */
const SURROUNDING_BAR_IDS = [
  'game-header-bar',
  'quick-spells-bar',
  'gothic-action-console',
  'game-full-width-log',
  'game-bottom-bar',
] as const;

/** Columns laid out beside the map column, whose width the canvas must leave free. */
const SIDE_COLUMN_IDS = ['combat-sidebar'] as const;

export class ViewportManager {
  public readonly virtualWidth: number;
  public readonly virtualHeight: number;
  public readonly integerScale: boolean;
  public readonly minScale: number;
  public readonly maxScale: number;

  public displayWidth = 960;
  public displayHeight = 600;
  public scale = 1;
  public dpr = 1;

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private resizeObserver?: ResizeObserver;
  private windowResizeListener?: () => void;
  private debounceTimer: number | null = null;
  private onResizeCallback?: () => void;
  private resizeListeners: Set<() => void> = new Set();

  public get canvasElement(): HTMLCanvasElement {
    return this.canvas;
  }

  public addResizeListener(callback: () => void): () => void {
    this.resizeListeners.add(callback);
    return () => {
      this.resizeListeners.delete(callback);
    };
  }

  public removeResizeListener(callback: () => void): void {
    this.resizeListeners.delete(callback);
  }

  private notifyResize(): void {
    if (this.onResizeCallback) {
      this.onResizeCallback();
    }
    for (const listener of this.resizeListeners) {
      try {
        listener();
      } catch (err) {
        console.error('[ViewportManager] Error in resize listener:', err);
      }
    }
  }

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, config: ViewportConfig = {}) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.virtualWidth = config.virtualWidth ?? 960;
    this.virtualHeight = config.virtualHeight ?? 600;
    this.integerScale = config.integerScale ?? false;
    this.minScale = config.minScale ?? 0.25;
    this.maxScale = config.maxScale ?? 4;

    // Apply baseline CSS pixelation styles to the canvas
    this.canvas.style.imageRendering = 'pixelated';

    this.recalculate();
    this.watchDpr();
    this.watchSurroundingBars();
  }

  /**
   * Re-measures whenever a surrounding bar's own size changes (wrapping to a second
   * line, a quickbar mounting/unmounting, a font finishing load, …) rather than only
   * on `window.resize`. A ResizeObserver watches `#center-viewport` (the window's
   * share) and each surrounding bar and side column itself: `#center-viewport` has a
   * fixed height, so a bar growing (the console gaining a companion card, say) does
   * not resize it, and would otherwise push the layout past the window.
   */
  private watchSurroundingBars(): void {
    if (typeof ResizeObserver === 'undefined' || typeof document === 'undefined') return;
    const centerEl = document.getElementById('center-viewport');
    if (!centerEl) return;
    // Re-fit on the next frame rather than inside the observer callback: resizing the
    // canvas resizes the bars being observed, which the browser would otherwise report
    // as a "ResizeObserver loop" error. One pending frame at a time.
    let pending = false;
    this.resizeObserver = new ResizeObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        this.recalculate();
        this.notifyResize();
      });
    });
    this.resizeObserver.observe(centerEl);
    for (const id of [...SURROUNDING_BAR_IDS, ...SIDE_COLUMN_IDS]) {
      const el = document.getElementById(id);
      if (el) this.resizeObserver.observe(el);
    }
  }

  private watchDpr(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const dpr = window.devicePixelRatio || 1;
    const mqString = `(resolution: ${dpr}dppx)`;
    const mq = window.matchMedia(mqString);
    const handler = () => {
      this.recalculate();
      this.watchDpr();
    };
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler, { once: true });
    }
  }

  /**
   * Recalculates canvas display dimensions, DPR backing buffer, and letterboxing.
   * Can accept explicit available width and height (e.g. for testing in Node/JSDOM).
   */
  public recalculate(explicitAvailW?: number, explicitAvailH?: number): void {
    const dpr =
      typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1;
    this.dpr = dpr;

    let availW = explicitAvailW;
    let availH = explicitAvailH;

    if (availW === undefined || availH === undefined) {
      if (typeof window !== 'undefined') {
        availW = window.innerWidth;
        availH = window.innerHeight;

        // If center-viewport element is present in DOM and has non-zero dimensions,
        // use its available dimensions so the canvas scales accurately within the widescreen layout
        if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
          const centerEl = document.getElementById('center-viewport');
          if (centerEl && typeof centerEl.clientWidth === 'number' && centerEl.clientWidth > 0) {
            availW = centerEl.clientWidth;
            if (typeof centerEl.clientHeight === 'number' && centerEl.clientHeight > 0) {
              availH = centerEl.clientHeight;
            }
          }
          // Columns beside the map column (the combat sidebar) take width, not height.
          for (const id of SIDE_COLUMN_IDS) {
            const el = document.getElementById(id);
            const w = el?.getBoundingClientRect().width ?? 0;
            if (w > 0 && availW > w + 320) availW -= w;
          }
          // Measure every bar actually mounted around the canvas rather than
          // guessing two fixed constants — a header wrapping to a second line, or a
          // bar this list didn't know about, used to silently blow the height
          // budget and get clipped by `body { overflow: hidden }`.
          // A bar nested inside another listed bar (the spell belt and verb row
          // live inside the action console) is already in its parent's height,
          // whichever order the list names them in.
          let overheadH = 0;
          const mounted = SURROUNDING_BAR_IDS.map((id) => document.getElementById(id)).filter(
            (el): el is HTMLElement => !!el
          );
          for (const el of mounted) {
            const nested = mounted.some(
              (other) => other !== el && typeof (other as any).contains === 'function' && (other as any).contains(el)
            );
            if (!nested) overheadH += el.getBoundingClientRect().height;
          }
          if (availH > overheadH + 120) {
            availH -= overheadH;
          }
        }
      } else {
        availW = this.virtualWidth;
        availH = this.virtualHeight;
      }
    }

    const targetW = Math.max(1, availW);
    const targetH = Math.max(1, availH);

    // Compute aspect-fit scale
    let scale = Math.min(targetW / this.virtualWidth, targetH / this.virtualHeight);

    // Integer scaling if preferred and screen is large enough
    if (this.integerScale && scale >= 1) {
      scale = Math.floor(scale);
    }

    // Clamp to [minScale, maxScale] — the ceiling stops the canvas from growing
    // past a sane size on very large/high-res displays instead of fighting a hard
    // CSS width cap on `#game-container` (which used to clip rather than scale).
    this.scale = Math.min(this.maxScale, Math.max(this.minScale, scale));

    this.displayWidth = Math.floor(this.virtualWidth * this.scale);
    this.displayHeight = Math.floor(this.virtualHeight * this.scale);

    // Set CSS display style (letterboxed in viewport)
    this.canvas.style.width = `${this.displayWidth}px`;
    this.canvas.style.height = `${this.displayHeight}px`;

    // Constrain parent game container width to match letterboxed canvas width
    if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
      const container = document.getElementById('game-container');
      if (container) {
        container.style.width = `${this.displayWidth}px`;
      }
    }

    // Backing store canvas pixels (scaled by devicePixelRatio)
    this.canvas.width = Math.floor(this.displayWidth * this.dpr);
    this.canvas.height = Math.floor(this.displayHeight * this.dpr);

    // Transform 2D rendering context so all draw operations use virtual coordinates
    this.applyContextTransform();
  }

  /**
   * Transforms the 2D rendering context so drawing in virtual resolution [0, virtualWidth] x [0, virtualHeight]
   * maps seamlessly to the high-DPI canvas backing buffer with zero subpixel blurring.
   */
  public applyContextTransform(): void {
    if (!this.ctx) return;

    if (typeof this.ctx.resetTransform === 'function') {
      this.ctx.resetTransform();
    } else {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // Scaling factors from virtual logical space to physical pixel backing store
    const scaleX = (this.displayWidth * this.dpr) / this.virtualWidth;
    const scaleY = (this.displayHeight * this.dpr) / this.virtualHeight;

    this.ctx.scale(scaleX, scaleY);
    // Canvas text is sized in CSS pixels (uiFont), so it needs the CSS-per-virtual scale.
    setCanvasTextScale(this.displayWidth / this.virtualWidth);
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * Converts client (browser screen) coordinates into virtual coordinates [0..virtualWidth, 0..virtualHeight].
   */
  public clientToVirtual(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    let borderLeft = 0;
    let borderTop = 0;
    let paddingLeft = 0;
    let paddingTop = 0;
    let contentW = rect.width;
    let contentH = rect.height;

    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const style = window.getComputedStyle(this.canvas);
      borderLeft = parseFloat(style.borderLeftWidth) || 0;
      borderTop = parseFloat(style.borderTopWidth) || 0;
      paddingLeft = parseFloat(style.paddingLeft) || 0;
      paddingTop = parseFloat(style.paddingTop) || 0;
      const borderRight = parseFloat(style.borderRightWidth) || 0;
      const borderBottom = parseFloat(style.borderBottomWidth) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      contentW = rect.width - borderLeft - borderRight - paddingLeft - paddingRight;
      contentH = rect.height - borderTop - borderBottom - paddingTop - paddingBottom;
    }

    const relX = clientX - rect.left - borderLeft - paddingLeft;
    const relY = clientY - rect.top - borderTop - paddingTop;

    const normX = contentW > 0 ? relX / contentW : 0;
    const normY = contentH > 0 ? relY / contentH : 0;

    const vx = Math.max(0, Math.min(this.virtualWidth, normX * this.virtualWidth));
    const vy = Math.max(0, Math.min(this.virtualHeight, normY * this.virtualHeight));

    return { x: vx, y: vy };
  }

  /**
   * Converts virtual coordinates to client screen space.
   */
  public virtualToClient(virtualX: number, virtualY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const normX = this.virtualWidth > 0 ? virtualX / this.virtualWidth : 0;
    const normY = this.virtualHeight > 0 ? virtualY / this.virtualHeight : 0;

    return {
      x: rect.left + normX * rect.width,
      y: rect.top + normY * rect.height,
    };
  }

  /**
   * Attaches a debounced resize listener to the window.
   */
  public attachResizeListener(callback: () => void, debounceMs = 60): void {
    this.onResizeCallback = callback;

    this.windowResizeListener = () => {
      if (this.debounceTimer !== null && typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
        window.clearTimeout(this.debounceTimer);
      }
      if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
        this.debounceTimer = window.setTimeout(() => {
          this.recalculate();
          this.notifyResize();
          this.debounceTimer = null;
        }, debounceMs);
      } else {
        this.recalculate();
        this.notifyResize();
      }
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', this.windowResizeListener);
    }
  }

  public detachResizeListener(): void {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function' && this.windowResizeListener) {
      window.removeEventListener('resize', this.windowResizeListener);
      this.windowResizeListener = undefined;
    }
    if (this.debounceTimer !== null && typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.onResizeCallback = undefined;
  }

  public destroy(): void {
    this.detachResizeListener();
    this.resizeListeners.clear();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }
}
