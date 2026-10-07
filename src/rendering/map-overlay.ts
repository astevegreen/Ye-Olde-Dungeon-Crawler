import { TileInspector, type GameEngine } from '../engine';
import { resolveThemeTokens } from './theme';
import { drawFloorMap } from './floorMap';
import { createDialogScrim, dialogButton, dialogHtml } from '../ui/dialog';
import { escapeHtml } from '../ui/html';

/** Floor 0 is the pack's town, named as the sidebar names it. */
const floorName = (engine: GameEngine, f: number): string => (f === 0 ? engine.manifest?.town?.name ?? 'Town' : `Floor ${f}`);

/**
 * The map viewer (M): every floor the hero has explored, one at a time, in the one dialog
 * frame (ADR-0011, Phase 7). The floor is drawn into a canvas inside the dialog by
 * drawFloorMap, the minimap's drawer. While it is open it owns the keyboard: InputHandler
 * hands it every key (handleKeyDown), so nothing reaches the simulation.
 */
export class MapOverlay {
  public isOpen = false;
  public viewedFloor = 1;
  private onStateChanged?: () => void;
  private engine?: GameEngine;
  private scrim: HTMLElement | null = null;
  /** Watches the open floor's canvas for size changes. */
  private resizeWatch?: ResizeObserver;

  constructor(onStateChanged?: () => void) {
    this.onStateChanged = onStateChanged;
  }

  public open(engine: GameEngine): void {
    this.engine = engine;
    this.isOpen = true;
    this.viewedFloor = engine.currentFloor;
    this.notifyStateChanged();
  }

  public close(): void {
    this.isOpen = false;
    this.notifyStateChanged();
  }

  public toggle(engine: GameEngine): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(engine);
    }
  }

  public prevFloor(engine: GameEngine): void {
    const visited = engine.getVisitedFloors();
    const idx = visited.indexOf(this.viewedFloor);
    if (idx > 0) {
      this.viewedFloor = visited[idx - 1];
    } else if (this.viewedFloor > 0) {
      this.viewedFloor -= 1;
    }
    this.notifyStateChanged();
  }

  public nextFloor(engine: GameEngine): void {
    const visited = engine.getVisitedFloors();
    const idx = visited.indexOf(this.viewedFloor);
    if (idx >= 0 && idx < visited.length - 1) {
      this.viewedFloor = visited[idx + 1];
    } else {
      const maxVisited = Math.max(...visited);
      if (this.viewedFloor < maxVisited) {
        this.viewedFloor += 1;
      }
    }
    this.notifyStateChanged();
  }

  public handleKeyDown(e: KeyboardEvent, engine: GameEngine): boolean {
    if (!this.isOpen) return false;

    const code = e.code;
    const key = e.key;

    if (code === 'KeyM' || key === 'Escape' || code === 'Space') {
      this.close();
      return true;
    }

    if (key === 'PageUp' || key === '<' || key === ',' || key === 'ArrowUp') {
      this.prevFloor(engine);
      return true;
    }

    if (key === 'PageDown' || key === '>' || key === '.' || key === 'ArrowDown') {
      this.nextFloor(engine);
      return true;
    }

    // Absorb other keystrokes while map viewer is open
    return true;
  }

  private notifyStateChanged(): void {
    this.sync();
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  /** Shows the dialog for the floor on view, or hides it when the map is closed. */
  private sync(): void {
    if (typeof document === 'undefined') return;
    if (!this.isOpen || !this.engine) {
      this.resizeWatch?.disconnect();
      this.resizeWatch = undefined;
      if (this.scrim) this.scrim.style.display = 'none';
      return;
    }
    this.scrim ??= createDialogScrim('map-viewer');
    const scrim = this.scrim;
    if (!scrim) return;
    const engine = this.engine;
    const visited = engine.getVisitedFloors();
    const idx = visited.indexOf(this.viewedFloor);
    const canGoUp = idx > 0 || this.viewedFloor > 0;
    const canGoDown = (idx >= 0 && idx < visited.length - 1) || this.viewedFloor < Math.max(...visited);
    const here = this.viewedFloor === engine.currentFloor;
    const map = engine.getFloorMap(this.viewedFloor);
    const landmarks = TileInspector.floorLandmarks(engine, this.viewedFloor);

    const chips = visited
      .map((f) => `<button type="button" class="st-subtab" data-floor="${f}" aria-selected="${f === this.viewedFloor}">${f === 0 ? escapeHtml(floorName(engine, 0)) : f}</button>`)
      .join('');
    scrim.innerHTML = dialogHtml({
      title: floorName(engine, this.viewedFloor),
      kicker: here ? 'Map · you are here' : `Map · you are on ${floorName(engine, engine.currentFloor)}`,
      icon: 'map',
      closeId: 'btn-map-close',
      closeTitle: 'Close (M or Esc)',
      size: 'full',
      body: `
        <div class="mv-nav">
          ${dialogButton('btn-map-up', 'Up', { key: '<', disabled: !canGoUp })}
          <div class="st-subtabs mv-floors" role="tablist" aria-label="Visited floors">${chips}</div>
          ${dialogButton('btn-map-down', 'Down', { key: '>', disabled: !canGoDown })}
        </div>
        <canvas id="map-viewer-canvas" class="mv-canvas ui-inset"></canvas>
        ${map ? '' : '<div class="ui-note mv-unvisited">This floor has not been visited yet.</div>'}
        <div class="mv-legend">
          <span><i class="mv-sw is-floor"></i>Floor</span><span><i class="mv-sw is-wall"></i>Wall</span>
          <span><i class="mv-sw is-stairs"></i>Stairs</span><span><i class="mv-sw is-door"></i>Door</span>
          <span><i class="mv-sw is-danger"></i>Trap${here ? ', monster' : ''}</span><span><i class="mv-sw is-you"></i>You</span>
        </div>
        ${landmarks.length > 0 ? `<div class="ui-note mv-landmarks"><b>Landmarks</b> ${landmarks.map((l) => escapeHtml(l.label)).join(' · ')}</div>` : ''}`,
      hints: [
        { keys: ['<', '>'], label: 'change floor' },
        { keys: ['M', 'Esc'], label: 'close' },
      ],
    });
    scrim.style.display = 'flex';

    scrim.querySelector('#btn-map-close')?.addEventListener('click', () => this.close());
    scrim.querySelector('#btn-map-up')?.addEventListener('click', () => this.prevFloor(engine));
    scrim.querySelector('#btn-map-down')?.addEventListener('click', () => this.nextFloor(engine));
    scrim.querySelectorAll<HTMLElement>('[data-floor]').forEach((chip) =>
      chip.addEventListener('click', () => {
        this.viewedFloor = Number(chip.dataset.floor);
        this.notifyStateChanged();
      })
    );

    const canvas = scrim.querySelector<HTMLCanvasElement>('#map-viewer-canvas');
    this.resizeWatch?.disconnect();
    this.resizeWatch = undefined;
    if (!canvas) return;
    this.drawFloor(canvas);
    // The canvas's CSS box follows the window (dialog.css); redraw when it changes, or the
    // floor stays squashed until the map is reopened. Its CSS sets its width and a zero flex
    // basis, so the backing store this writes can't resize the box and loop.
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeWatch = new ResizeObserver(() => this.drawFloor(canvas));
      this.resizeWatch.observe(canvas);
    }
  }

  private drawFloor(canvas: HTMLCanvasElement): void {
    const engine = this.engine;
    if (!this.isOpen || !engine) return;
    const here = this.viewedFloor === engine.currentFloor;
    const map = engine.getFloorMap(this.viewedFloor);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (map) {
      drawFloorMap(canvas, map, engine.getFloorFov(this.viewedFloor), resolveThemeTokens(engine.manifest?.theme), {
        live: here,
        traps: true,
        hero: here ? { x: engine.player.x, y: engine.player.y } : null,
        maxCell: Math.round(48 * dpr),
      });
    }
  }
}
