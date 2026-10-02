import { resolveManaTerms } from '../engine';
import {
  type GameEngine,
  type Position,
  type ActionResult,
  type SpellDefinition,
  traceProjectile,
  getAreaOfEffectTiles,
  type ElementType,
  WandItem,
  ScrollItem,
  type Item,
} from '../engine';
import type { Camera } from './camera';
import { elementColor, resolveThemeTokens } from './theme';
import { escapeHtml } from '../ui/html';
import { iconHtml } from '../ui/icons';
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
  spellDef: SpellDefinition;
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

  public confirmFire(engine: GameEngine): ActionResult | null {
    if (!this.activeEntry) return null;

    const entry = this.activeEntry;
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

    // Save visual path for flash animation
    if (entry.spellDef.targetType === 'ray' || entry.spellDef.targetType === 'tile') {
      const trace = traceProjectile(
        engine.map,
        engine.player.x,
        engine.player.y,
        this.reticleX,
        this.reticleY,
        entry.spellDef.range,
        entry.spellDef.reflects,
        engine.player.id
      );

      this.lastFired = {
        path: trace.path,
        element: entry.spellDef.element,
        color: spellColor(engine, entry.spellDef.element),
        isAoE: entry.spellDef.areaOfEffect > 0,
        impactTile: trace.impactTile,
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
    offsetY: number
  ): void {
    // 1. Render Last Fired Projectile Flash (lasts 1200ms)
    if (this.lastFired && Date.now() - this.lastFired.timestamp < 1200) {
      this.renderProjectileEffect(ctx, camera, cellSize, offsetX, offsetY);
    }

    // 2. Render Targeting Reticle & Aim Line
    if (this.mode === 'reticle' && this.activeEntry) {
      this.renderReticleAndRay(ctx, engine, camera, cellSize, offsetX, offsetY);
    }
  }

  private renderReticleAndRay(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    if (!this.activeEntry) return;

    const spell = this.activeEntry.spellDef;
    const px = engine.player.x;
    const py = engine.player.y;
    const rx = this.reticleX;
    const ry = this.reticleY;

    // Calculate simulated projectile path (including reflections!)
    const trace = traceProjectile(
      engine.map,
      px,
      py,
      rx,
      ry,
      spell.range,
      spell.reflects,
      engine.player.id
    );

    // Draw projected ray line
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = spellColor(engine, spell.element);
    if (spell.element === 'fire') {
      ctx.setLineDash([6, 3]);
    } else if (spell.element === 'cold') {
      ctx.setLineDash([3, 3]);
    } else {
      ctx.setLineDash([4, 4]);
    }

    const playerScreen = camera.worldToScreen(px, py, cellSize, offsetX, offsetY);
    if (playerScreen) {
      ctx.beginPath();
      ctx.moveTo(playerScreen.x + cellSize / 2, playerScreen.y + cellSize / 2);

      for (const step of trace.path) {
        if (!step || typeof step.x !== 'number' || typeof step.y !== 'number') continue;
        const stepScreen = camera.worldToScreen(step.x, step.y, cellSize, offsetX, offsetY);
        if (stepScreen) {
          ctx.lineTo(stepScreen.x + cellSize / 2, stepScreen.y + cellSize / 2);
        }
      }
      ctx.stroke();
    }
    ctx.restore();

    // Area of effect highlight
    if (spell.areaOfEffect > 0 && trace.impactTile && typeof trace.impactTile.x === 'number' && typeof trace.impactTile.y === 'number') {
      const aoeTiles = getAreaOfEffectTiles(engine.map, trace.impactTile.x, trace.impactTile.y, spell.areaOfEffect);
      const danger = resolveThemeTokens(engine.manifest?.theme).bad;
      ctx.save();
      ctx.fillStyle = danger;
      ctx.strokeStyle = danger;
      ctx.lineWidth = 1;

      for (const tile of aoeTiles) {
        if (!tile || typeof tile.x !== 'number' || typeof tile.y !== 'number') continue;
        const screen = camera.worldToScreen(tile.x, tile.y, cellSize, offsetX, offsetY);
        if (screen) {
          ctx.globalAlpha = 0.25;
          ctx.fillRect(screen.x, screen.y, cellSize, cellSize);
          ctx.globalAlpha = 0.7;
          ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, cellSize - 1, cellSize - 1);
        }
      }
      ctx.restore();
    }

    // Draw Reticle Brackets at (rx, ry)
    const reticleScreen = camera.worldToScreen(rx, ry, cellSize, offsetX, offsetY);
    if (reticleScreen) {
      const x = reticleScreen.x;
      const y = reticleScreen.y;
      const bracketLen = 7;

      ctx.save();
      ctx.strokeStyle = resolveThemeTokens(engine.manifest?.theme).title;
      ctx.lineWidth = 2;

      // Top-Left corner
      ctx.beginPath();
      ctx.moveTo(x, y + bracketLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + bracketLen, y);
      ctx.stroke();

      // Top-Right corner
      ctx.beginPath();
      ctx.moveTo(x + cellSize - bracketLen, y);
      ctx.lineTo(x + cellSize, y);
      ctx.lineTo(x + cellSize, y + bracketLen);
      ctx.stroke();

      // Bottom-Left corner
      ctx.beginPath();
      ctx.moveTo(x, y + cellSize - bracketLen);
      ctx.lineTo(x, y + cellSize);
      ctx.lineTo(x + bracketLen, y + cellSize);
      ctx.stroke();

      // Bottom-Right corner
      ctx.beginPath();
      ctx.moveTo(x + cellSize - bracketLen, y + cellSize);
      ctx.lineTo(x + cellSize, y + cellSize);
      ctx.lineTo(x + cellSize, y + cellSize - bracketLen);
      ctx.stroke();
      ctx.restore();
    }
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
  return `
    <div class="mc-head"><span class="mc-title">${iconHtml('cast')} <span>${escapeHtml(spell.name)}</span></span><span class="mc-tag ui-num">${escapeHtml(cost)}</span></div>
    <div class="mc-body">
      <div class="mc-sub">Target</div>
      ${targetHtml}
      ${spell.reflects ? '<div class="ui-note">Bounces off walls</div>' : ''}
    </div>`;
}

/** A spell's color on the map: its element's color in the pack, else the info role. */
function spellColor(engine: GameEngine, element: ElementType): string {
  return elementColor(engine.manifest, element) ?? resolveThemeTokens(engine.manifest?.theme).info;
}
