import { resolveThemeTokens, type ThemeTokens } from './theme';
import type { GameEngine } from '../engine';
import { escapeHtml } from '../ui/html';
import { iconHtml } from '../ui/icons';
import type { MapCardSpec } from '../ui/mapCards/mapCardLayer';
import type { Camera } from './camera';
import type { Monster } from '../engine';
import { Visibility } from '../engine';
import type { Position } from '../engine';

export class IntentOverlay {
  /**
   * Draws the danger tiles and the pulsing reticle for every monster winding up a heavy
   * attack, in the pack's danger color. The ability's name is a DOM card (cards(), below).
   */
  public render(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    camera: Camera,
    cellSize: number,
    offsetX: number,
    offsetY: number
  ): void {
    const windingMonsters = windingUp(engine);
    if (windingMonsters.length === 0) return;

    const theme = resolveThemeTokens(engine.manifest?.theme);
    ctx.save();

    const now = Date.now();
    const pulse = 0.5 + 0.5 * Math.sin(now / 160); // 0.0 to 1.0
    const alpha = 0.25 + 0.25 * pulse; // 0.25 to 0.50

    for (const monster of windingMonsters) {
      const targetTiles = dangerTiles(monster);
      if (targetTiles.length === 0) continue;

      // Draw danger zone tiles
      for (const tile of targetTiles) {
        // Only render if explored or visible
        const vis = engine.fov.getVisibility(tile.x, tile.y);
        if (vis === Visibility.Unexplored) continue;

        const screenPos = camera.worldToScreen(tile.x, tile.y, cellSize, offsetX, offsetY);
        if (!screenPos) continue;

        const { x: px, y: py } = screenPos;

        // 1. Semi-transparent danger fill
        ctx.globalAlpha = alpha;
        ctx.fillStyle = theme.bad;
        ctx.fillRect(px, py, cellSize, cellSize);

        // 2. Hazard hatch
        ctx.globalAlpha = alpha * 0.7;
        ctx.strokeStyle = theme.text;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py + cellSize);
        ctx.lineTo(px + cellSize, py);
        ctx.stroke();

        // 3. Danger border
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.strokeStyle = theme.bad;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 0.5, py + 0.5, cellSize - 1, cellSize - 1);
      }

      // The pulsing reticle on the primary target tile
      const primaryTile = monster.intent?.targetTile ?? targetTiles[0];
      const primaryScreen = camera.worldToScreen(primaryTile.x, primaryTile.y, cellSize, offsetX, offsetY);

      if (primaryScreen) {
        const cx = primaryScreen.x + cellSize / 2;
        const cy = primaryScreen.y + cellSize / 2;

        const reticleRadius = (cellSize * 0.42) + (pulse * 2);
        ctx.globalAlpha = 0.7 + 0.3 * pulse;
        ctx.strokeStyle = theme.text;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, reticleRadius, 0, Math.PI * 2);
        ctx.stroke();

        // Crosshairs
        ctx.beginPath();
        ctx.moveTo(cx - reticleRadius - 3, cy);
        ctx.lineTo(cx + reticleRadius + 3, cy);
        ctx.moveTo(cx, cy - reticleRadius - 3);
        ctx.lineTo(cx, cy + reticleRadius + 3);
        ctx.stroke();
      }
    }

    ctx.restore();
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
  return raw.filter((t): t is Position => Boolean(t && typeof t.x === 'number' && typeof t.y === 'number'));
}
