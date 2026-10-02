import { Monster, type GameMap, type ThemeTokens } from '../engine';

/** What the drawer needs to know about sight on the floor. */
export interface FloorSight {
  isExplored(x: number, y: number): boolean;
  isVisible(x: number, y: number): boolean;
}

export interface FloorMapOptions {
  /** Brighten the tiles in sight and show the monsters there (the floor the hero is on). */
  live?: boolean;
  /** Mark revealed traps. */
  traps?: boolean;
  hero?: { x: number; y: number } | null;
  /** The largest block per tile, in canvas pixels. */
  maxCell?: number;
}

/**
 * Draws a floor's explored tiles into a DOM canvas, one block per tile, centered: the
 * sidebar's minimap and the map viewer. Colors are the pack's roles (ADR-0011): floor in
 * the strong line color (the line color once out of sight), walls in a raised surface,
 * stairs in gold, doors in the frame color, traps and monsters in the danger color, the
 * hero in the info color (the accent sits too close to the frame for doors and the hero
 * to tell apart).
 */
export function drawFloorMap(
  canvas: HTMLCanvasElement,
  map: GameMap,
  sight: FloorSight | undefined,
  theme: Required<ThemeTokens>,
  opts: FloorMapOptions = {}
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const cell = Math.max(1, Math.min(opts.maxCell ?? Infinity, Math.floor(Math.min(canvas.width / map.width, canvas.height / map.height))));
  const ox = Math.floor((canvas.width - map.width * cell) / 2);
  const oy = Math.floor((canvas.height - map.height * cell) / 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!sight) return;

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (!sight.isExplored(x, y)) continue;
      const tile = map.getTile(x, y);
      if (!tile) continue;
      const lit = opts.live === true && sight.isVisible(x, y);
      let color: string;
      if (tile.type === 'stairs_down' || tile.type === 'stairs_up') color = theme.gold;
      else if (tile.type.startsWith('door')) color = theme.frame;
      else if (tile.passable) color = lit ? theme.lineStrong : theme.line;
      else color = lit ? theme.surface2 : theme.surface1;
      if (opts.traps && map.getTrapAt(x, y)?.revealed) color = theme.bad;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * cell, oy + y * cell, cell, cell);
    }
  }

  if (opts.live) {
    ctx.fillStyle = theme.bad;
    for (const entity of map.getAllEntities()) {
      if (!(entity instanceof Monster) || !entity.isAlive() || !sight.isVisible(entity.x, entity.y)) continue;
      ctx.fillRect(ox + entity.x * cell - 1, oy + entity.y * cell - 1, cell + 2, cell + 2);
    }
  }

  if (opts.hero) {
    ctx.fillStyle = theme.info;
    ctx.fillRect(ox + opts.hero.x * cell - 2, oy + opts.hero.y * cell - 2, cell + 4, cell + 4);
  }
}
