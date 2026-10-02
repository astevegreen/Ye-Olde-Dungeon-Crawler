import type { GameEngine, Item, TileDefinition } from '../engine';
import { Monster, Container } from '../engine';
import type { Camera } from './camera';
import type { ThemeTokens } from '../engine';
import { resolveThemeTokens } from './theme';
import { escapeHtml } from '../ui/html';
import { iconHtml, type UiIconName } from '../ui/icons';
import type { MapCardSpec } from '../ui/mapCards/mapCardLayer';

/**
 * Zero-click inspect: pointing at a tile (the mouse, a sidebar row, or the companion card)
 * brackets a monster on the map and shows its target card, or labels a pile, door or
 * stairs. An ally (the hero's own faction, e.g. the companion) is bracketed and carded as
 * one, not as a target. The brackets are canvas; the card and the labels are DOM cards
 * over the map (card(), below).
 */
export class TacticalTargetOverlay {
  private hoveredWorldX: number | null = null;
  private hoveredWorldY: number | null = null;

  public setHoveredTile(x: number | null, y: number | null): void {
    this.hoveredWorldX = x;
    this.hoveredWorldY = y;
  }

  public clearHover(): void {
    this.hoveredWorldX = null;
    this.hoveredWorldY = null;
  }

  public get hoveredTile(): { x: number; y: number } | null {
    if (this.hoveredWorldX === null || this.hoveredWorldY === null) return null;
    return { x: this.hoveredWorldX, y: this.hoveredWorldY };
  }

  /** The hovered tile when it is on the map and in sight. */
  private visibleHover(engine: GameEngine): { x: number; y: number } | null {
    const t = this.hoveredTile;
    if (!t || !engine.map?.inBounds(t.x, t.y) || !engine.fov.isVisible(t.x, t.y)) return null;
    return t;
  }

  private hoveredMonster(engine: GameEngine, t: { x: number; y: number }): Monster | null {
    const entity = engine.map.getEntityAt(t.x, t.y);
    return entity instanceof Monster && entity.isAlive() ? entity : null;
  }

  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    _virtualWidth: number,
    _virtualHeight: number,
    themeTokens?: ThemeTokens
  ): void {
    if (this.hoveredWorldX === null || this.hoveredWorldY === null) return;
    const t = this.visibleHover(engine);
    const monster = t && this.hoveredMonster(engine, t);
    if (!t || !monster) return;
    const theme = resolveThemeTokens(themeTokens);
    this.renderTargetBrackets(ctx, camera, t.x, t.y, cellSize, offsetX, offsetY, isAlly(monster) ? theme.good : theme.accent);
  }

  /** The monster's target card, docked top-right, or a label above a pile, door or stairs. */
  public card(engine: GameEngine, camera: Camera, cellSize: number, offsetX: number, offsetY: number): MapCardSpec | null {
    const t = this.visibleHover(engine);
    if (!t) return null;

    const monster = this.hoveredMonster(engine, t);
    if (monster) return { className: 'mc-panel mc-target', place: { dock: 'top-right' }, html: targetCardHtml(monster) };

    const screen = camera.worldToScreen(t.x, t.y, cellSize, offsetX, offsetY);
    if (!screen) return null;
    const place = { tile: { x: screen.x, y: screen.y, size: cellSize } };

    const items = engine.map.getItemsAt(t.x, t.y);
    if (items && items.length > 0) return { className: 'mc-pill is-loot', place, html: pileLabelHtml(items) };

    const label = fixtureLabel(engine.map.getTile(t.x, t.y));
    return label ? { className: 'mc-pill is-fixture', place, html: `${iconHtml(label.icon)} ${escapeHtml(label.text)}` } : null;
  }

  /** Draws brackets around the hovered monster's tile, in `color` */
  private renderTargetBrackets(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    worldX: number,
    worldY: number,
    cs: number,
    offsetX: number,
    offsetY: number,
    color: string
  ): void {
    const screenPos = camera.worldToScreen(worldX, worldY, cs, offsetX, offsetY);
    if (!screenPos) return;

    ctx.save();
    const px = screenPos.x;
    const py = screenPos.y;
    const bLen = Math.floor(cs * 0.28);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(px, py + bLen);
    ctx.lineTo(px, py);
    ctx.lineTo(px + bLen, py);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(px + cs - bLen, py);
    ctx.lineTo(px + cs, py);
    ctx.lineTo(px + cs, py + bLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(px, py + cs - bLen);
    ctx.lineTo(px, py + cs);
    ctx.lineTo(px + bLen, py + cs);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(px + cs - bLen, py + cs);
    ctx.lineTo(px + cs, py + cs);
    ctx.lineTo(px + cs, py + cs - bLen);
    ctx.stroke();

    ctx.restore();
  }
}

/** On the hero's side: the companion, or anything else of the player's faction. */
function isAlly(monster: Monster): boolean {
  return monster.faction === 'player';
}

/**
 * The target card: name, health, and a wind-up warning or the monster's conditions. An
 * ally's card has the shield, not the attack icon, says it is at your side, and never
 * warns of its wind-ups; a neutral monster's says it stands aside.
 */
export function targetCardHtml(monster: Monster): string {
  const ally = isAlly(monster);
  const pct = monster.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((monster.hp / monster.maxHp) * 100))) : 0;
  const neutral = monster.faction === 'neutral';
  let note = ally ? `<div class="mc-intent is-good">At your side</div>` : neutral ? `<div class="mc-intent is-info">Stands aside</div>` : '';
  if (!ally && !neutral && monster.intent?.type === 'windup') {
    note = `<div class="mc-intent is-warn">${iconHtml('warning')} Winding up an attack</div>`;
  } else {
    const statuses = monster.statusManager?.getAll() ?? [];
    if (statuses.length > 0) note += `<div class="mc-line mc-status"><span>${escapeHtml(statuses.map((s) => s.type).join(', '))}</span></div>`;
  }
  return `
    <div class="mc-head"><span class="mc-title">${iconHtml(ally ? 'shield' : neutral ? 'info' : 'attack')} <span>${escapeHtml(monster.name)}</span></span><span class="mc-tag ui-num">${monster.hp} / ${monster.maxHp}</span></div>
    <div class="mc-body"><div class="ui-bar mc-hp"><i style="width: ${pct}%"></i></div>${note}</div>`;
}

/** A pile's label: the container, or the top item and how many more lie under it. */
export function pileLabelHtml(items: readonly Item[]): string {
  const first = items[0];
  if (first instanceof Container) {
    return `${iconHtml('chest')} ${escapeHtml(first.displayName)}${first.wasOpened ? '' : ' (unopened)'}`;
  }
  const more = items.length > 1 ? ` (+${items.length - 1} more)` : '';
  return `${iconHtml('loot')} ${escapeHtml(first.displayName)}${more}`;
}

function fixtureLabel(tile: TileDefinition | null | undefined): { icon: UiIconName; text: string } | null {
  switch (tile?.type) {
    case 'stairs_down':
      return { icon: 'stairs', text: 'Stairs down' };
    case 'stairs_up':
      return { icon: 'stairs', text: 'Stairs up' };
    case 'door_closed':
      return { icon: 'door', text: 'Closed door' };
    case 'door_open':
      return { icon: 'door', text: 'Open doorway' };
    default:
      return null;
  }
}
