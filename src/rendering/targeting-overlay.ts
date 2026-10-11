import { resolveManaTerms } from '../engine';
import {
  type GameEngine,
  type Position,
  type ActionResult,
  type SpellDefinition,
  castGeometry,
  getAreaOfEffectTiles,
  type ElementType,
  WandItem,
  ScrollItem,
  type Item,
} from '../engine';
import type { Camera } from './camera';
import { elementColor, resolveThemeTokens, withAlpha } from './theme';
import { drawAimReticle, drawBlastZone, type ScreenPoint } from './markers/markers';
import { escapeHtml } from '../ui/html';
import { iconHtml } from '../ui/icons';
import { spellPower } from '../ui/spellPower';
import type { MapCardSpec } from '../ui/mapCards/mapCardLayer';
import type { UIModal } from '../ui/modalStack';

export interface SpellbookEntry {
  key: string;
  type: 'spell' | 'wand' | 'scroll';
  id: string;
  name: string;
  manaCost?: number;
  charges?: number;
  maxCharges?: number;
  sourceItem?: Item;
  /** The spell as this cast resolves (a grimoire slot's synergies applied). */
  spellDef: SpellDefinition;
  /** One note per grimoire synergy that shaped `spellDef`. */
  gridNotes?: string[];
  locationLabel?: string;
}

export class TargetingOverlay implements UIModal {
  public readonly id = 'targeting';
  public mode: 'closed' | 'reticle' = 'closed';
  public activeEntry?: SpellbookEntry;
  public reticleX = 0;
  public reticleY = 0;
  public lastFired?: {
    path: Array<{ x: number; y: number; isReflection?: boolean }>;
    element: ElementType;
    /** The element's color in the pack, resolved when the spell fired. */
    color: string;
    isAoE: boolean;
    impactTile: Position;
    timestamp: number;
  };
  public onClose?: () => void;
  private onStateChanged?: () => void;
  private engine?: GameEngine;

  constructor(onStateChanged?: () => void) {
    this.onStateChanged = onStateChanged;
  }

  public get isOpen(): boolean {
    return this.mode !== 'closed';
  }

  public set isOpen(val: boolean) {
    if (!val) {
      this.mode = 'closed';
    }
  }

  public startTargeting(entry: SpellbookEntry, engine: GameEngine): void {
    this.engine = engine;
    this.activeEntry = entry;

    // Self spells don't need targeting reticle; cast immediately
    if (entry.spellDef.targetType === 'self' || entry.spellDef.targetType === 'inventory_item') {
      this.confirmFire(engine);
      this.close();
      return;
    }

    // Initialize reticle in front of player or at nearest enemy
    const enemies = engine.map.getAllEntities().filter(
      (e) => e.isAlive() && e.isHostileTo(engine.player) && engine.fov.isVisible(e.x, e.y)
    );

    if (enemies.length > 0) {
      this.reticleX = enemies[0].x;
      this.reticleY = enemies[0].y;
    } else {
      this.reticleX = engine.player.x + 1;
      this.reticleY = engine.player.y;
    }

    this.mode = 'reticle';
    this.notify();
  }

  public moveReticle(dx: number, dy: number, engine: GameEngine): void {
    const nx = this.reticleX + dx;
    const ny = this.reticleY + dy;
    if (engine.map.inBounds(nx, ny)) {
      this.reticleX = nx;
      this.reticleY = ny;
      this.notify();
    }
  }

  /** Puts the reticle on a tile, as the mouse points (N23, tracker 4.4). Returns whether it moved. */
  public aimAt(x: number, y: number, engine: GameEngine): boolean {
    if (this.mode !== 'reticle' || !engine.map.inBounds(x, y)) return false;
    if (x === this.reticleX && y === this.reticleY) return false;
    this.reticleX = x;
    this.reticleY = y;
    this.notify();
    return true;
  }

  public confirmFire(engine: GameEngine): ActionResult | null {
    if (!this.activeEntry) return null;

    const entry = this.activeEntry;
    // Where the cast goes, read before it changes the map (a kill lets a ray run on).
    const geo = castGeometry(engine, entry.spellDef, engine.player, { x: this.reticleX, y: this.reticleY });
    let result: ActionResult;
    // Commands may report the energy they spent in `data.cost`; default to a full turn.
    const costOf = (data: unknown): number =>
      typeof data === 'object' && data !== null && 'cost' in data && typeof data.cost === 'number' ? data.cost : 100;

    if (entry.type === 'wand' && entry.sourceItem instanceof WandItem) {
      const res = engine.commandBus.dispatch({
        type: 'zap_wand',
        payload: { itemId: entry.sourceItem.id, targetX: this.reticleX, targetY: this.reticleY },
      });
      result = { success: res.success, message: res.message ?? '', cost: costOf(res.data), effects: res.effects };
    } else if (entry.type === 'scroll' && entry.sourceItem instanceof ScrollItem) {
      const res = engine.commandBus.dispatch({
        type: 'read_scroll',
        payload: { itemId: entry.sourceItem.id, targetX: this.reticleX, targetY: this.reticleY },
      });
      result = { success: res.success, message: res.message ?? '', cost: costOf(res.data), effects: res.effects };
    } else {
      const res = engine.commandBus.dispatch({
        type: 'cast_spell',
        payload: { spellId: entry.id, targetX: this.reticleX, targetY: this.reticleY },
      });
      result = { success: res.success, message: res.message ?? '', cost: costOf(res.data), effects: res.effects };
    }

    // The after-image of the flight, as the cast made it, unless the pack draws the spell's
    // own bolt and impact (`SpellFxCatalog`), which it would cover.
    const fx = entry.spellDef.visual?.fx ?? entry.spellDef.element;
    if (geo.ray && !engine.manifest?.spellFx?.elements[fx]) {
      this.lastFired = {
        path: geo.ray.path,
        element: entry.spellDef.element,
        color: spellColor(engine, entry.spellDef.element),
        isAoE: Boolean(geo.burst),
        impactTile: geo.burst?.epicenter ?? geo.ray.impactTile,
        timestamp: Date.now(),
      };
    }

    this.close();
    return result;
  }

  public close(): void {
    const wasOpen = this.isOpen;
    this.mode = 'closed';
    this.activeEntry = undefined;
    this.notify();
    if (wasOpen && this.onClose) {
      this.onClose();
    }
  }

  public handleKeyDown(e: KeyboardEvent, engine?: GameEngine): boolean {
    if (!this.isOpen) return false;

    const eng = engine ?? this.engine;
    const code = e.code;

    // Cancellation: Escape closes targeting
    if (code === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return true;
    }


    if (this.mode === 'reticle') {
      // Confirmation: Enter, Space, KeyF fires spell
      if (code === 'Enter' || code === 'Space' || code === 'KeyF') {
        e.preventDefault();
        e.stopPropagation();
        if (eng) this.confirmFire(eng);
        return true;
      }

      let rdx = 0;
      let rdy = 0;
      let isAimMove = false;

      switch (code) {
        case 'ArrowUp':
        case 'KeyW':
        case 'KeyK':
        case 'Numpad8':
          rdy = -1;
          isAimMove = true;
          break;
        case 'ArrowDown':
        case 'KeyS':
        case 'KeyJ':
        case 'Numpad2':
          rdy = 1;
          isAimMove = true;
          break;
        case 'ArrowLeft':
        case 'KeyA':
        case 'KeyH':
        case 'Numpad4':
          rdx = -1;
          isAimMove = true;
          break;
        case 'ArrowRight':
        case 'KeyD':
        case 'KeyL':
        case 'Numpad6':
          rdx = 1;
          isAimMove = true;
          break;
        case 'Numpad7':
        case 'KeyY':
          rdx = -1;
          rdy = -1;
          isAimMove = true;
          break;
        case 'Numpad9':
        case 'KeyU':
          rdx = 1;
          rdy = -1;
          isAimMove = true;
          break;
        case 'Numpad1':
        case 'KeyB':
          rdx = -1;
          rdy = 1;
          isAimMove = true;
          break;
        case 'Numpad3':
        case 'KeyN':
          rdx = 1;
          rdy = 1;
          isAimMove = true;
          break;
      }

      if (isAimMove && eng) {
        e.preventDefault();
        e.stopPropagation();
        this.moveReticle(rdx, rdy, eng);
        return true;
      }

      // Absorb all other keys during reticle targeting to prevent game leakage or sidebar scrolling
      e.preventDefault();
      e.stopPropagation();
      return true;
    }

    return false;
  }

  /** The aiming card, docked to the side of the map away from the reticle. */
  public card(engine: GameEngine, camera: Camera, cellSize: number, offsetX: number, offsetY: number, canvasW: number): MapCardSpec | null {
    if (this.mode !== 'reticle' || !this.activeEntry) return null;
    const screen = camera.worldToScreen(this.reticleX, this.reticleY, cellSize, offsetX, offsetY);
    const dock = (screen?.x ?? 0) > canvasW / 2 ? 'top-left' : 'top-right';
    return { className: 'mc-panel mc-aim', place: { dock }, live: true, html: aimCardHtml(engine, this.activeEntry, this.reticleX, this.reticleY) };
  }

  private notify(): void {
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    t = 0
  ): boolean {
    // 1. Render Last Fired Projectile Flash (lasts 1200ms)
    if (this.lastFired && Date.now() - this.lastFired.timestamp < 1200) {
      this.renderProjectileEffect(ctx, camera, cellSize, offsetX, offsetY);
    }

    // 2. Render Targeting Reticle & Aim Line
    if (this.mode === 'reticle' && this.activeEntry) {
      this.renderReticleAndRay(ctx, engine, camera, cellSize, offsetX, offsetY, t);
      return t > 0;
    }
    return false;
  }

  private renderReticleAndRay(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    t: number
  ): void {
    if (!this.activeEntry) return;

    const spell = this.activeEntry.spellDef;
    const px = engine.player.x;
    const py = engine.player.y;
    const rx = this.reticleX;
    const ry = this.reticleY;

    // The flight and burst the cast will make (`castGeometry`, as the spell pipeline
    // resolves it): a thrown burst stops at the reticle, a reflecting element bounces.
    const geo = castGeometry(engine, spell, engine.player, { x: rx, y: ry });
    const path = geo.ray?.path ?? [];

    const theme = resolveThemeTokens(engine.manifest?.theme);
    const color = spellColor(engine, spell.element);

    // The blast it will make, under the line and the reticle.
    if (geo.burst) {
      const blast: ScreenPoint[] = [];
      for (const tile of getAreaOfEffectTiles(engine.map, geo.burst.epicenter.x, geo.burst.epicenter.y, geo.burst.radius)) {
        const screen = camera.worldToScreen(tile.x, tile.y, cellSize, offsetX, offsetY);
        if (screen) blast.push(screen);
      }
      drawBlastZone(ctx, blast, cellSize, t, color, theme);
    }

    // The flight, dashed in the element's rhythm over a dark keyline.
    const line: ScreenPoint[] = [];
    for (const step of [{ x: px, y: py }, ...path]) {
      const screen = camera.worldToScreen(step.x, step.y, cellSize, offsetX, offsetY);
      if (screen) line.push({ x: screen.x + cellSize / 2, y: screen.y + cellSize / 2 });
    }
    if (line.length > 1) {
      const dash = spell.element === 'fire' ? [6, 3] : spell.element === 'cold' ? [3, 3] : [4, 4];
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(line[0].x, line[0].y);
      for (const p of line.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = withAlpha(theme.markerInk, 0.55);
      ctx.lineWidth = 4;
      ctx.setLineDash(dash.map((d, i) => (i % 2 ? d - 2 : d + 2)));
      ctx.lineDashOffset = 1;
      ctx.stroke();
      ctx.lineDashOffset = 0;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash(dash);
      ctx.stroke();
      ctx.restore();
    }

    const reticleScreen = camera.worldToScreen(rx, ry, cellSize, offsetX, offsetY);
    const centre = shortBurstCentre(geo, rx, ry);
    if (!centre) {
      if (reticleScreen) drawAimReticle(ctx, reticleScreen.x, reticleScreen.y, cellSize, t, color, theme);
      return;
    }
    // A burst stopped short (a creature or wall in its way, or out of range): the reticle sits
    // where it will burst, and a faint, still one stays on the tile the arrows move.
    if (reticleScreen) {
      ctx.save();
      ctx.globalAlpha = 0.4;
      drawAimReticle(ctx, reticleScreen.x, reticleScreen.y, cellSize, 0, color, theme);
      ctx.restore();
    }
    const centreScreen = camera.worldToScreen(centre.x, centre.y, cellSize, offsetX, offsetY);
    if (centreScreen) drawAimReticle(ctx, centreScreen.x, centreScreen.y, cellSize, t, color, theme);
  }

  private renderProjectileEffect(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    if (!this.lastFired) return;
    const elapsed = Date.now() - this.lastFired.timestamp;
    const alpha = Math.max(0, 1 - elapsed / 1200);

    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.strokeStyle = this.lastFired.color;
    ctx.shadowColor = this.lastFired.color;
    if (this.lastFired.element === 'lightning') {
      // Lightning bolt jagged electric zigzag
      ctx.lineWidth = 3;
      ctx.shadowBlur = 8;
    } else if (this.lastFired.element === 'fire') {
      ctx.lineWidth = 4;
      ctx.shadowBlur = 10;
    } else {
      ctx.lineWidth = 3;
      ctx.shadowBlur = 6;
    }

    ctx.beginPath();
    let first = true;
    for (const step of this.lastFired.path) {
      if (!step || typeof step.x !== 'number' || typeof step.y !== 'number') continue;
      const s = camera.worldToScreen(step.x, step.y, cellSize, offsetX, offsetY);
      if (s) {
        const cx = s.x + cellSize / 2;
        const cy = s.y + cellSize / 2;
        if (first) {
          ctx.moveTo(cx, cy);
          first = false;
        } else {
          ctx.lineTo(cx, cy);
        }
      }
    }
    ctx.stroke();

    // Impact blast flash
    if (this.lastFired.impactTile && typeof this.lastFired.impactTile.x === 'number' && typeof this.lastFired.impactTile.y === 'number') {
      const impactScreen = camera.worldToScreen(
        this.lastFired.impactTile.x,
        this.lastFired.impactTile.y,
        cellSize,
        offsetX,
        offsetY
      );
      if (impactScreen) {
        const ix = impactScreen.x + cellSize / 2;
        const iy = impactScreen.y + cellSize / 2;
        ctx.fillStyle = this.lastFired.color;
        ctx.beginPath();
        ctx.arc(ix, iy, cellSize * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
}

const AFFINITY_NOTE: Record<string, { text: string; tone: string }> = {
  weak: { text: 'Weak to', tone: 'is-good' },
  resistant: { text: 'Resists', tone: 'is-bad' },
  immune: { text: 'Immune to', tone: 'is-bad' },
  absorbing: { text: 'Absorbs', tone: 'is-bad' },
};

/** The aiming card: what is aimed, what it costs, and what stands under the reticle. */
export function aimCardHtml(engine: GameEngine, entry: SpellbookEntry, reticleX: number, reticleY: number): string {
  const spell = entry.spellDef;
  const cost =
    entry.type === 'wand'
      ? `${entry.charges ?? 0} / ${entry.maxCharges ?? 0} charges`
      : `${spell.manaCost} ${resolveManaTerms(engine.manifest).unit}`;
  const target = engine.map.getEntityAt(reticleX, reticleY);
  let targetHtml = '<div class="mc-line ui-muted"><span>Empty space</span></div>';
  if (target && target.isAlive()) {
    const pct = target.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((target.hp / target.maxHp) * 100))) : 0;
    const aff = AFFINITY_NOTE[target.elementalResistances[spell.element] ?? 'neutral'];
    targetHtml = `
      <div class="mc-line"><b class="mc-foe">${escapeHtml(target.name)}</b><span class="ui-num">${target.hp} / ${target.maxHp}</span></div>
      <div class="ui-bar mc-hp"><i style="width: ${pct}%"></i></div>
      ${aff ? `<div class="mc-intent ${aff.tone}">${aff.text} ${escapeHtml(spell.element)}</div>` : ''}`;
  }
  const power = entry.type === 'spell' ? spellPower(spell, { engine, player: engine.player }) : 0;
  const grid = entry.gridNotes?.length ? `<div class="ui-note">From the grid: ${entry.gridNotes.map(escapeHtml).join(' · ')}</div>` : '';
  // A burst stops at the first creature or wall in its flight, and at the end of its range.
  const geo = castGeometry(engine, spell, engine.player, { x: reticleX, y: reticleY });
  const centre = shortBurstCentre(geo, reticleX, reticleY);
  const blocker = centre ? engine.map.getEntityAt(centre.x, centre.y) : null;
  const short = !centre
    ? ''
    : blocker && blocker.isAlive() && blocker !== engine.player
      ? `${escapeHtml(blocker.name)} is in the way`
      : geo.ray?.hitWall
        ? 'a wall is in the way'
        : 'out of range';
  return `
    <div class="mc-head"><span class="mc-title">${iconHtml('cast')} <span>${escapeHtml(spell.name)}</span></span><span class="mc-tag ui-num">${escapeHtml(cost)}</span></div>
    <div class="mc-body">
      ${power ? `<div class="mc-line"><span>Power</span><span class="ui-num">${power}</span></div>` : ''}
      ${grid}
      <div class="mc-sub">Target</div>
      ${targetHtml}
      ${short ? `<div class="ui-note">Bursts short: ${short}</div>` : ''}
      ${spell.reflects ? '<div class="ui-note">Bounces off walls</div>' : ''}
    </div>`;
}

/** Where a burst lands when that isn't the tile aimed at; null when it lands there or doesn't burst. */
function shortBurstCentre(geo: ReturnType<typeof castGeometry>, x: number, y: number): Position | null {
  const at = geo.burst?.epicenter;
  return at && (at.x !== x || at.y !== y) ? at : null;
}

/** A spell's color on the map: its element's color in the pack, else the info role. */
function spellColor(engine: GameEngine, element: ElementType): string {
  return elementColor(engine.manifest, element) ?? resolveThemeTokens(engine.manifest?.theme).info;
}
