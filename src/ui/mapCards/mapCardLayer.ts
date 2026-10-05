/**
 * The cards that sit over the map (ADR-0011, Phase 7): the Look card, the target card and
 * the labels over a hovered pile, door or stairs, the wind-up banner, the aiming card and
 * the mode hint. They are DOM, styled by src/ui/styles/mapcards.css on the role tokens, in
 * one layer laid exactly over the game canvas; what is drawn on the map itself (reticles,
 * brackets, danger tiles, the aim line) stays on the canvas.
 *
 * The renderer asks each overlay for its card after every frame and hands the answers to
 * `set`, which rewrites a card only when its markup or place changed.
 */
import { currentUiScale } from '../uiScale';

/** Where a card sits: docked to an edge of the map, or above a tile. */
export type MapCardPlace =
  | { dock: 'top-left' | 'top-right' | 'bottom' }
  /** A tile's top-left corner and width, in the canvas's virtual pixels. */
  | { tile: { x: number; y: number; size: number } };

export interface MapCardSpec {
  html: string;
  /** Classes beside `mc-card`, e.g. `mc-pill is-danger`. */
  className: string;
  place: MapCardPlace;
  /** Read aloud when it changes (`aria-live`); for cards the player steers, like Look. */
  live?: boolean;
}

interface MountedCard {
  el: HTMLElement;
  key: string;
}

export class MapCardLayer {
  private readonly el: HTMLElement;
  private readonly cards = new Map<string, MountedCard>();
  /** CSS pixels per virtual canvas pixel. */
  private scale = 1;
  private box = '';

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.el = document.createElement('div');
    this.el.className = 'mc-layer';
    canvas.insertAdjacentElement('afterend', this.el);
  }

  /** Lays the layer over the canvas; `scale` is CSS pixels per virtual pixel. */
  public sync(scale: number): void {
    this.scale = scale;
    const c = this.canvas;
    const box = `${c.offsetLeft},${c.offsetTop},${c.offsetWidth},${c.offsetHeight}`;
    if (box === this.box) return;
    this.box = box;
    Object.assign(this.el.style, {
      left: `${c.offsetLeft}px`,
      top: `${c.offsetTop}px`,
      width: `${c.offsetWidth}px`,
      height: `${c.offsetHeight}px`,
    });
  }

  /** Shows, moves or (with null) removes the card `id`. */
  public set(id: string, spec: MapCardSpec | null): void {
    const mounted = this.cards.get(id);
    if (!spec) {
      if (mounted) {
        mounted.el.remove();
        this.cards.delete(id);
      }
      return;
    }
    const place = 'dock' in spec.place ? `dock:${spec.place.dock}` : this.tileStyle(spec.place.tile);
    const key = `${spec.className}|${place}|${spec.html}`;
    if (mounted?.key === key) return;

    const el = mounted?.el ?? document.createElement('div');
    el.className = `mc-card ${spec.className}${'dock' in spec.place ? ` mc-dock-${spec.place.dock}` : ' mc-above'}`;
    el.setAttribute('data-card', id);
    if (spec.live) el.setAttribute('aria-live', 'polite');
    el.innerHTML = spec.html;
    el.style.left = '';
    el.style.top = '';
    if (!('dock' in spec.place)) {
      const [left, top] = place.split(',');
      el.style.left = left;
      el.style.top = top;
    }
    if (!mounted) this.el.appendChild(el);
    this.cards.set(id, { el, key });
    if (!('dock' in spec.place)) this.keepInside(el);
  }

  /** Sets a family of cards at once (ids `<group>:<key>`), removing the family's others. */
  public setGroup(group: string, specs: Record<string, MapCardSpec>): void {
    const prefix = `${group}:`;
    for (const id of [...this.cards.keys()]) {
      if (id.startsWith(prefix) && !(id.slice(prefix.length) in specs)) this.set(id, null);
    }
    for (const [key, spec] of Object.entries(specs)) this.set(prefix + key, spec);
  }

  /** Takes the layer and its cards off the page (the renderer is going away). */
  public remove(): void {
    this.cards.clear();
    this.el.remove();
  }

  /** Centered above the tile. A card is zoomed by the UI scale, which scales its own left and
   *  top too, so they are written in the card's units: CSS pixels over the scale. */
  private tileStyle(t: { x: number; y: number; size: number }): string {
    const z = currentUiScale();
    return `${Math.round(((t.x + t.size / 2) * this.scale) / z)}px,${Math.round((t.y * this.scale) / z)}px`;
  }

  /** Nudges a card centered over a tile back inside the map at its left and right edges. */
  private keepInside(el: HTMLElement): void {
    // In the layer's CSS pixels, then back into the card's zoomed units.
    const z = currentUiScale();
    const half = (el.offsetWidth * z) / 2;
    const width = this.el.clientWidth;
    const left = parseFloat(el.style.left) * z;
    if (!half || !width || Number.isNaN(left)) return;
    const clamped = Math.min(Math.max(left, half + 4), width - half - 4);
    if (clamped !== left) el.style.left = `${clamped / z}px`;
  }
}
