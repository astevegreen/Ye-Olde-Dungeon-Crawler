import type { GameEngine, InspectedItem, ThemeTokens, TileInspection } from '../engine';
import { TileInspector } from '../engine';
import type { Camera } from './camera';
import { resolveThemeTokens } from './theme';
import { escapeHtml } from '../ui/html';
import { iconHtml, type UiIconName } from '../ui/icons';
import { itemToneClass } from '../ui/inventory/itemTone';
import type { MapCardSpec } from '../ui/mapCards/mapCardLayer';
import { formatWeight } from '../ui/units';

export class InspectOverlay {
  public mode: 'closed' | 'inspect' = 'closed';
  public cursorX = 0;
  public cursorY = 0;
  private onStateChanged?: () => void;
  private theme?: Required<ThemeTokens>;

  constructor(onStateChanged?: () => void) {
    this.onStateChanged = onStateChanged;
  }

  public get isOpen(): boolean {
    return this.mode === 'inspect';
  }

  public open(engine: GameEngine): void {
    this.mode = 'inspect';
    this.cursorX = engine.player.x;
    this.cursorY = engine.player.y;
    this.notify();
  }

  public close(): void {
    this.mode = 'closed';
    this.notify();
  }

  public toggle(engine: GameEngine): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open(engine);
    }
  }

  public moveCursor(dx: number, dy: number, engine: GameEngine): void {
    const nx = this.cursorX + dx;
    const ny = this.cursorY + dy;

    // Constrain reticle within map bounds and explored/visible tiles
    if (engine.map.inBounds(nx, ny) && engine.fov.isExplored(nx, ny)) {
      this.cursorX = nx;
      this.cursorY = ny;
      this.notify();
    }
  }

  private notify(): void {
    if (this.onStateChanged) {
      this.onStateChanged();
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    _canvasW: number,
    _canvasH: number,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    if (!this.isOpen) return;

    this.theme = resolveThemeTokens(engine.manifest?.theme);

    // The reticle on the map; the card is DOM (card(), below).
    const screenPos = camera.worldToScreen(this.cursorX, this.cursorY, cellSize, offsetX, offsetY);
    if (screenPos) {
      this.renderReticle(ctx, screenPos.x, screenPos.y, cellSize);
    }
  }

  private renderReticle(ctx: CanvasRenderingContext2D, px: number, py: number, cs: number): void {
    ctx.save();
    const theme = this.theme ?? resolveThemeTokens();

    // Subtle accent tile tint
    ctx.fillStyle = theme.accent;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(px, py, cs, cs);
    ctx.globalAlpha = 1.0;

    // High-contrast corner brackets
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2.5;
    const cornerLen = Math.floor(cs * 0.28);

    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(px, py + cornerLen);
    ctx.lineTo(px, py);
    ctx.lineTo(px + cornerLen, py);
    ctx.stroke();

    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(px + cs - cornerLen, py);
    ctx.lineTo(px + cs, py);
    ctx.lineTo(px + cs, py + cornerLen);
    ctx.stroke();

    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(px, py + cs - cornerLen);
    ctx.lineTo(px, py + cs);
    ctx.lineTo(px + cornerLen, py + cs);
    ctx.stroke();

    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(px + cs - cornerLen, py + cs);
    ctx.lineTo(px + cs, py + cs);
    ctx.lineTo(px + cs, py + cs - cornerLen);
    ctx.stroke();

    ctx.restore();
  }

  /** The Look card, docked to the side of the map away from the reticle. */
  public card(
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    canvasW: number
  ): MapCardSpec | null {
    if (!this.isOpen) return null;
    const data = TileInspector.inspectTile(engine, this.cursorX, this.cursorY);
    const screen = camera.worldToScreen(this.cursorX, this.cursorY, cellSize, offsetX, offsetY);
    const dock = (screen?.x ?? 0) > canvasW / 2 ? 'top-left' : 'top-right';
    return { className: 'mc-panel', place: { dock }, live: true, html: lookCardHtml(engine, data) };
  }
}

const INTENT_LOOK: Record<string, { label: (ability?: string) => string; icon: UiIconName | null; tone: string }> = {
  windup: { label: (a) => `Winding up: ${a ?? 'a heavy strike'}`, icon: 'warning', tone: 'is-warn' },
  attack: { label: () => 'Engaging', icon: 'attack', tone: 'is-bad' },
  fleeing: { label: () => 'Retreating', icon: 'retreat', tone: 'is-info' },
  searching: { label: () => 'Searching for you', icon: 'search', tone: 'is-warn' },
  idle: { label: () => 'Resting', icon: 'rest', tone: '' },
};

function statTag(it: InspectedItem): string {
  if (it.stats?.attackBonus) return ` (+${it.stats.attackBonus} attack${it.elementalAffix ? `, ${it.elementalAffix.element}` : ''})`;
  if (it.stats?.defenseBonus) return ` (+${it.stats.defenseBonus} defense)`;
  if (it.elementalAffix) return ` (${it.elementalAffix.element})`;
  return '';
}

/** What the Look card says about one tile: terrain, traps, who stands there, what lies there. */
export function lookCardHtml(engine: GameEngine, data: TileInspection): string {
  const parts: string[] = [];
  if (data.terrain) {
    parts.push(
      `<div class="mc-line"><b>${escapeHtml(data.terrain.name)}</b><span class="${data.terrain.passable ? 'ui-up' : 'ui-down'}">${data.terrain.passable ? 'Passable' : 'Blocked'}</span></div>`
    );
    if (data.terrain.landmark) parts.push(`<div class="mc-line ui-note">Landmark: ${escapeHtml(data.terrain.landmark)}</div>`);
  }
  for (const trap of data.traps) {
    parts.push(`<div class="mc-line mc-warn">${iconHtml('warning')} Trap: ${escapeHtml(trap.name)}</div>`);
  }
  if (data.entity) {
    const ent = data.entity;
    const pct = ent.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((ent.hp / ent.maxHp) * 100))) : 0;
    const intent = ent.intent ? INTENT_LOOK[ent.intent.type] : undefined;
    parts.push(`
      <div class="mc-sec">
        <div class="mc-line"><b class="${ent.type === 'player' ? 'mc-hero' : ent.type === 'monster' ? 'mc-foe' : ''}">${escapeHtml(ent.name)}</b><span class="ui-num">${ent.hp} / ${ent.maxHp}</span></div>
        <div class="ui-bar mc-hp"><i style="width: ${pct}%"></i></div>
        <div class="mc-line ui-muted"><span>Speed: ${ent.speedTier.toLowerCase()}</span><span>${ent.statusEffects.length ? escapeHtml(ent.statusEffects.join(', ')) : 'No afflictions'}</span></div>
        ${intent && ent.intent ? `<div class="mc-intent ${intent.tone}">${intent.icon ? iconHtml(intent.icon) : ''} ${escapeHtml(intent.label(ent.intent.abilityName))}</div>` : ''}
      </div>`);
  }
  if (data.items.length > 0) {
    const onTile = engine.map.getItemsAt(data.x, data.y) ?? [];
    const rows = data.items
      .slice(0, 3)
      .map((it) => {
        const tone = itemToneClass(onTile.find((i) => i.id === it.id));
        return `<div class="mc-line"><span class="mc-item${tone}">${escapeHtml(it.name || 'Item')}${escapeHtml(statTag(it))}</span><span class="ui-muted ui-num">${it.sensed ? '' : formatWeight(it.weight)}</span></div>`;
      })
      .join('');
    const more = data.items.length > 3 ? `<div class="ui-note">and ${data.items.length - 3} more</div>` : '';
    parts.push(`<div class="mc-sec"><div class="mc-sub">On the ground (${data.items.length})</div>${rows}${more}</div>`);
  }
  if (parts.length === 0) parts.push('<div class="ui-note">Nothing you know of.</div>');
  const remembered = data.visibility !== 'visible';
  return `
    <div class="mc-head"><span class="mc-title">${iconHtml('look')} Look</span><span class="mc-tag${remembered ? '' : ' is-seen'}">${remembered ? 'Remembered' : 'In sight'}</span></div>
    <div class="mc-body">${parts.join('')}</div>`;
}
