import { describe, expect, it } from 'vitest';
import { GameMap } from '../../src/engine/grid/map';
import { TILES } from '../../src/engine/grid/tile';
import { traceProjectile } from '../../src/engine/magic/targeting';
import { lineOfFire, type FireTile } from '../../e2e/soak/lineOfFire';

/**
 * Soak T3: the bot fires a bolt only where its flight reaches the target. `lineOfFire` runs in
 * the page (the bot cannot import there), so it must agree with the engine's own flight,
 * `traceProjectile`, over the length `castGeometry` gives a ray of a spell's range.
 */

type Pos = { x: number; y: number };
type Reach = (getTile: (x: number, y: number) => FireTile | null | undefined, from: Pos, to: Pos, range: number) => boolean;

const RANGE = 6;

const tileAt = (map: GameMap) => (x: number, y: number) => (map.inBounds(x, y) ? map.getTile(x, y) : undefined);

/** Whether the engine's bolt, cast at `range`, flies through `to` (castReaches for a ray). */
function engineReaches(map: GameMap, from: Pos, to: Pos, range: number): boolean {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const grid = Math.max(dx, dy);
  const maxRange = grid === 0 ? range : (range * Math.hypot(dx, dy)) / grid;
  const ray = traceProjectile(map, from.x, from.y, to.x, to.y, maxRange, false);
  return ray.path.some((p) => p.x === to.x && p.y === to.y);
}

/** Every tile within RANGE of `caster` where `reach` disagrees with the engine's flight. */
function disagreements(map: GameMap, caster: Pos, reach: Reach): string[] {
  const out: string[] = [];
  for (let y = caster.y - RANGE; y <= caster.y + RANGE; y++) {
    for (let x = caster.x - RANGE; x <= caster.x + RANGE; x++) {
      const to = { x, y };
      const want = engineReaches(map, caster, to, RANGE);
      if (reach(tileAt(map), caster, to, RANGE) !== want) out.push(`${x},${y} engine=${want}`);
    }
  }
  return out;
}

/** The bot's sight line before T3 (playerBot.ts `lineOfSight`): what a bolt check must not be. */
const botLineOfSight: Reach = (getTile, a, b, range) => {
  if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > range) return false;
  if (a.x === b.x && a.y === b.y) return true;
  let x = a.x;
  let y = a.y;
  const ddx = Math.abs(b.x - x);
  const ddy = -Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = ddx + ddy;
  for (;;) {
    const e2 = 2 * err;
    if (e2 >= ddy) { err += ddy; x += sx; }
    if (e2 <= ddx) { err += ddx; y += sy; }
    if (x === b.x && y === b.y) return true;
    const t = getTile(x, y) as (FireTile & { transparent?: boolean }) | undefined;
    if (!t || !t.transparent) return false;
  }
};

/** The castReach.test.ts corner: a pillar the sight line steps past and the bolt clips. */
function pillarMap(): { map: GameMap; caster: Pos } {
  const map = new GameMap(16, 14, TILES.FLOOR);
  map.setTile(7, 7, TILES.WALL);
  return { map, caster: { x: 5, y: 5 } };
}

/** A room with an inner wall corner (an L), a chasm and iron bars, near the map's edge. */
function cornerRoom(): { map: GameMap; caster: Pos } {
  const map = new GameMap(14, 12, TILES.FLOOR);
  for (let x = 0; x < 14; x++) {
    map.setTile(x, 0, TILES.WALL);
    map.setTile(x, 11, TILES.WALL);
  }
  for (let y = 0; y < 12; y++) {
    map.setTile(0, y, TILES.WALL);
    map.setTile(13, y, TILES.WALL);
  }
  for (let x = 5; x <= 9; x++) map.setTile(x, 4, TILES.WALL);
  for (let y = 4; y <= 8; y++) map.setTile(9, y, TILES.WALL);
  map.setTile(3, 7, TILES.CHASM);
  map.setTile(6, 8, TILES.IRON_BARS);
  map.setTile(4, 2, TILES.PILLAR);
  return { map, caster: { x: 6, y: 6 } };
}

describe('lineOfFire: the soak bot fires only where the bolt arrives', () => {
  it('the corner: the sight line is clear while the bolt hits the pillar', () => {
    const { map, caster } = pillarMap();
    const hero = { x: 8, y: 7 };
    expect(botLineOfSight(tileAt(map), caster, hero, RANGE)).toBe(true);
    expect(traceProjectile(map, caster.x, caster.y, hero.x, hero.y, RANGE, false).wallTile).toEqual({ x: 7, y: 7 });
    expect(lineOfFire(tileAt(map), caster, hero, RANGE)).toBe(false);
  });

  for (const [name, fixture] of [['pillar', pillarMap], ['corner room', cornerRoom]] as const) {
    it(`${name}: agrees with traceProjectile on every tile within range ${RANGE}`, () => {
      const { map, caster } = fixture();
      expect(disagreements(map, caster, lineOfFire)).toEqual([]);
    });
  }

  it('the old sight line fails the same parity check', () => {
    const { map, caster } = pillarMap();
    expect(disagreements(map, caster, botLineOfSight)).toContain('8,7 engine=false');
  });

  it('still agrees when rebuilt from its source text, as the bot does in the page', () => {
    const rebuilt = new Function(`return (${lineOfFire.toString()})`)() as Reach;
    const { map, caster } = cornerRoom();
    expect(disagreements(map, caster, rebuilt)).toEqual([]);
  });
});
