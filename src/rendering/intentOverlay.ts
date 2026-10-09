import { resolveThemeTokens, type ThemeTokens } from './theme';
import type { GameEngine } from '../engine';
import { escapeHtml } from '../ui/html';
import { iconHtml } from '../ui/icons';
import type { MapCardSpec } from '../ui/mapCards/mapCardLayer';
import type { Camera } from './camera';
import type { Monster } from '../engine';
import { Visibility } from '../engine';
import type { Position } from '../engine';
import { drawDangerZone, type ScreenPoint } from './markers/markers';

export class IntentOverlay {
  /**
   * Draws the tiles every monster winding up a heavy attack will strike, as one danger zone:
   * hatched, with an edge round its outside, moving on the draw's clock `now` (0 holds it
   * still). The ability's name is a DOM card (cards(), below). True when a zone was drawn,
   * so the map keeps redrawing on its idle tick.
   */
  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number,
    now = 0
  ): boolean {
    const seen = new Set<string>();
    const zone: ScreenPoint[] = [];
    for (const monster of windingUp(engine)) {
      const primary = monster.intent?.targetTile;
      const struck = isPosition(primary) ? [...dangerTiles(monster), primary] : dangerTiles(monster);
      for (const tile of struck) {
        const id = `${tile.x},${tile.y}`;
        if (seen.has(id) || engine.fov.getVisibility(tile.x, tile.y) === Visibility.Unexplored) continue;
        const screen = camera.worldToScreen(tile.x, tile.y, cellSize, offsetX, offsetY);
        if (!screen) continue;
        seen.add(id);
        zone.push(screen);
      }
    }
    if (zone.length === 0) return false;
    drawDangerZone(ctx, zone, cellSize, now, resolveThemeTokens(engine.manifest?.theme));
    return true;
  }

  /** One banner per monster winding up, naming the ability above the tile it will strike. */
  public cards(engine: GameEngine, camera: Camera, cellSize: number, offsetX: number, offsetY: number): Record<string, MapCardSpec> {
    const cards: Record<string, MapCardSpec> = {};
    for (const monster of windingUp(engine)) {
      const tiles = dangerTiles(monster);
      const primary = monster.intent?.targetTile ?? tiles[0];
      if (!primary || typeof primary.x !== 'number' || typeof primary.y !== 'number') continue;
      if (engine.fov.getVisibility(primary.x, primary.y) === Visibility.Unexplored) continue;
      const screen = camera.worldToScreen(primary.x, primary.y, cellSize, offsetX, offsetY);
      if (!screen) continue;
      cards[monster.id] = {
        className: 'mc-pill is-danger',
        place: { tile: { x: screen.x, y: screen.y, size: cellSize } },
        html: `${iconHtml('warning')} ${escapeHtml(monster.intent?.abilityName ?? 'Heavy strike')}`,
      };
    }
    return cards;
  }

  /**
   * Draws ground surfaces and gases over the terrain, each with the pack's art for its type
   * (`atlas.overlays`, keyed `surface~<type>` and `gas~<type>`). A type the pack draws no art
   * for still shows, as a neutral wash in the theme's role colors.
   */
  public renderSurfaces(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    if (!engine.surfaces) return;
    const activeCells = engine.surfaces.getAllActiveCells();
    if (activeCells.length === 0) return;

    const overlays = engine.manifest?.atlas?.overlays;
    const theme = resolveThemeTokens(engine.manifest?.theme);
    const now = Date.now();
    ctx.save();

    for (const item of activeCells) {
      if (!item || typeof item.x !== 'number' || typeof item.y !== 'number' || !item.cell) continue;
      const { x, y, cell } = item;
      const vis = engine.fov.getVisibility(x, y);
      if (vis === Visibility.Unexplored) continue;

      const screenPos = camera.worldToScreen(x, y, cellSize, offsetX, offsetY);
      if (!screenPos) continue;
      const { x: px, y: py } = screenPos;
      const at = { x, y, now };

      // The ground surface, then the gas above it.
      if (cell.surface) {
        const art = overlays?.[`surface~${cell.surface.type}`];
        ctx.save();
        if (art) art(ctx, px, py, cellSize, at);
        else drawNeutralSurface(ctx, theme, px, py, cellSize);
        ctx.restore();
      }
      if (cell.gas) {
        const art = overlays?.[`gas~${cell.gas.type}`];
        ctx.save();
        if (art) art(ctx, px, py, cellSize, at);
        else drawNeutralGas(ctx, theme, px, py, cellSize);
        ctx.restore();
      }
    }

    ctx.restore();
  }
}

/** A surface the pack draws no art for: a wash and an inset edge in the caution role. */
function drawNeutralSurface(ctx: CanvasRenderingContext2D, theme: Required<ThemeTokens>, px: number, py: number, size: number): void {
  ctx.fillStyle = theme.warn;
  ctx.globalAlpha = 0.3;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.strokeStyle = theme.warn;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 2.5, py + 2.5, size - 5, size - 5);
}

/** A gas the pack draws no art for: a pale cloud over the cell. */
function drawNeutralGas(ctx: CanvasRenderingContext2D, theme: Required<ThemeTokens>, px: number, py: number, size: number): void {
  ctx.fillStyle = theme.textSoft;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(px + size / 2, py + size / 2, size * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

/** Living monsters declaring a wind-up. */
function windingUp(engine: GameEngine): Monster[] {
  return (engine.map.getAllEntities().filter((e) => e.type === 'monster' && e.isAlive()) as Monster[]).filter(
    (m) => m.intent?.type === 'windup'
  );
}

/** The tiles a wind-up will strike, skipping malformed ones. */
function dangerTiles(monster: Monster): Position[] {
  const intent = monster.intent;
  if (!intent) return [];
  const raw = intent.targetTiles && intent.targetTiles.length > 0 ? intent.targetTiles : intent.targetTile ? [intent.targetTile] : [];
  return raw.filter(isPosition);
}

function isPosition(t: Position | null | undefined): t is Position {
  return Boolean(t && typeof t.x === 'number' && typeof t.y === 'number');
}
