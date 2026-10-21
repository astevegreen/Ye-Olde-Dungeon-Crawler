import { describe, expect, it } from 'vitest';
import { computeDangerTiles } from '../../src/engine/ai/intent';
import { GameMap } from '../../src/engine/grid/map';
import { TILES } from '../../src/engine/grid/tile';
import { telegraphChoice, telegraphExit, type ExitStep, type TelegraphCheck } from '../../e2e/soak/telegraphExit';

/**
 * Soak T4b: under a telegraph no single step clears (Gálmr's Rime Shockwave, a radius-2 blast
 * centred on the hero), the bot heals if hurt, else starts the way out, and waits only when
 * neither is possible. Both functions run in the page, rebuilt from their source text.
 */

type Pos = { x: number; y: number };
type Grid = { isOpen: (x: number, y: number) => boolean; inDanger: (x: number, y: number) => boolean; avoid: (x: number, y: number) => boolean };

/**
 * A layout from rows: `#` wall, `.` floor, `D` floor in danger, `@` the hero (in danger),
 * `~` a hazard, `!` a hazard in danger, `m` a creature in danger.
 */
function parse(rows: string[]): Grid & { hero: Pos } {
  let hero: Pos = { x: -1, y: -1 };
  rows.forEach((row, y) => {
    const x = row.indexOf('@');
    if (x >= 0) hero = { x, y };
  });
  const at = (x: number, y: number): string => rows[y]?.[x] ?? '#';
  return {
    hero,
    isOpen: (x, y) => at(x, y) !== '#' && at(x, y) !== 'm',
    inDanger: (x, y) => 'D@!m'.includes(at(x, y)),
    avoid: (x, y) => '~!'.includes(at(x, y)),
  };
}

/** Walk the way out from `from`: the first step, then a breadth-first count of the rest. */
function reachesSafety(g: Grid, from: Pos, step: ExitStep): boolean {
  const first = { x: from.x + step.dx, y: from.y + step.dy };
  if (!g.isOpen(first.x, first.y) || g.avoid(first.x, first.y)) return false;
  const rest = telegraphExit(g.isOpen, g.inDanger, g.avoid, first, 400);
  const restSteps = g.inDanger(first.x, first.y) ? rest?.steps ?? Infinity : 0;
  return 1 + restSteps === step.steps;
}

/** The dodge before T4b (playerBot.ts `safeSteps`): a neighbour that is open, safe and not avoided. */
const todaysSafeSteps = (g: Grid, p: Pos): Pos[] => {
  const out: Pos[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && g.isOpen(p.x + dx, p.y + dy) && !g.inDanger(p.x + dx, p.y + dy) && !g.avoid(p.x + dx, p.y + dy)) out.push({ x: dx, y: dy });
    }
  }
  return out;
};

describe('telegraphExit: the way out of a telegraph one step cannot clear', () => {
  it('leaves a radius-2 blast centred on the hero in two steps, where one step finds nothing', () => {
    const map = new GameMap(11, 11, TILES.FLOOR);
    const hero = { x: 5, y: 5 };
    const danger = computeDangerTiles(hero, hero, 'blast', map, 5, 2);
    expect(danger).toHaveLength(21); // a 5x5 square without its corners
    const g: Grid = {
      isOpen: (x, y) => map.inBounds(x, y) && Boolean(map.getTile(x, y)?.passable),
      inDanger: (x, y) => danger.some((t) => t.x === x && t.y === y),
      avoid: () => false,
    };
    expect(todaysSafeSteps(g, hero)).toEqual([]);
    const step = telegraphExit(g.isOpen, g.inDanger, g.avoid, hero, 400);
    expect(step).not.toBeNull();
    expect(step!.steps).toBe(2);
    expect(Math.max(Math.abs(step!.dx), Math.abs(step!.dy))).toBe(1);
    expect(reachesSafety(g, hero, step!)).toBe(true);
    // Ties go the same way every time: the first diagonal in reading order.
    expect(step).toEqual({ dx: -1, dy: -1, steps: 2 });
  });

  it('follows a corridor to its only exit, three tiles away, not past a creature', () => {
    // East and west both end in danger (west at a creature); the way out runs south.
    const corridor = parse([
      '#######',
      '#mD@DD#',
      '###D###',
      '###D###',
      '###.###',
      '#######',
    ]);
    expect(todaysSafeSteps(corridor, corridor.hero)).toEqual([]);
    const step = telegraphExit(corridor.isOpen, corridor.inDanger, corridor.avoid, corridor.hero, 400);
    expect(step).toEqual({ dx: 0, dy: 1, steps: 3 });
    expect(reachesSafety(corridor, corridor.hero, step!)).toBe(true);
  });

  it('returns null when every reachable tile is in danger, or the search runs out', () => {
    const shut = parse(['#####', '#D@D#', '#mDD#', '#####']);
    expect(telegraphExit(shut.isOpen, shut.inDanger, shut.avoid, shut.hero, 400)).toBeNull();
    // A safe tile behind a creature is no way out: it blocks the path.
    const blocked = parse(['######', '#D@m.#', '######']);
    expect(telegraphExit(blocked.isOpen, blocked.inDanger, blocked.avoid, blocked.hero, 400)).toBeNull();
    const far = parse(['#########', '#@DDDDD.#', '#########']);
    expect(telegraphExit(far.isOpen, far.inDanger, far.avoid, far.hero, 3)).toBeNull();
    expect(telegraphExit(far.isOpen, far.inDanger, far.avoid, far.hero, 400)).toEqual({ dx: 1, dy: 0, steps: 6 });
  });

  it('goes round a hazard on the shortest way, and never ends on one', () => {
    const open = parse([
      '#######',
      '#DDDDD#',
      '#D@DD.#',
      '#DDDDD#',
      '#######',
    ]);
    expect(telegraphExit(open.isOpen, open.inDanger, open.avoid, open.hero, 400)).toEqual({ dx: 1, dy: -1, steps: 3 });
    // Fire across the way east: the path to the only exit bends south round it, and is longer
    // than the straight five steps it takes with the fire gone.
    const fire = parse([
      '#########',
      '#DD!DDDD#',
      '#D@!D!D.#',
      '#DD!D!DD#',
      '#DDDDDDD#',
      '#########',
    ]);
    expect(telegraphExit(fire.isOpen, fire.inDanger, () => false, fire.hero, 400)?.steps).toBe(5);
    const step = telegraphExit(fire.isOpen, fire.inDanger, fire.avoid, fire.hero, 400);
    expect(step).toEqual({ dx: 0, dy: 1, steps: 6 });
    expect(reachesSafety(fire, fire.hero, step!)).toBe(true);
    // A hazard tile out of danger is never the goal.
    const lure = parse(['#######', '#~@DD.#', '#######']);
    expect(telegraphExit(lure.isOpen, lure.inDanger, lure.avoid, lure.hero, 400)).toEqual({ dx: 1, dy: 0, steps: 3 });
  });

  it('still finds the same way when rebuilt from its source text, as the bot does in the page', () => {
    const rebuilt = new Function(`return (${telegraphExit.toString()})`)() as typeof telegraphExit;
    const g = parse(['#######', '#DD!DD#', '#D@!D.#', '#DDDDD#', '#######']);
    expect(rebuilt(g.isOpen, g.inDanger, g.avoid, g.hero, 400)).toEqual(telegraphExit(g.isOpen, g.inDanger, g.avoid, g.hero, 400));
  });
});

describe('telegraphChoice: what the bot does under a telegraph', () => {
  const cornered = (over: Partial<TelegraphCheck>): TelegraphCheck => ({
    safeStep: false,
    hurt: false,
    healCastable: true,
    exit: true,
    adjacentFoe: true,
    ...over,
  });

  it('dodges first whenever one step clears the attack', () => {
    expect(telegraphChoice(cornered({ safeStep: true, hurt: true }))).toBe('dodge');
  });

  it('heals when hurt with a castable Heal, else takes the exit step, else fights or waits', () => {
    expect(telegraphChoice(cornered({ hurt: true }))).toBe('heal');
    expect(telegraphChoice(cornered({ hurt: false }))).toBe('exit');
    expect(telegraphChoice(cornered({ hurt: true, healCastable: false }))).toBe('exit');
    expect(telegraphChoice(cornered({ exit: false }))).toBe('melee');
    expect(telegraphChoice(cornered({ exit: false, adjacentFoe: false }))).toBe('wait');
    expect(telegraphChoice(cornered({ hurt: true, healCastable: false, exit: false, adjacentFoe: false }))).toBe('wait');
  });

  it('still chooses the same when rebuilt from its source text', () => {
    const rebuilt = new Function(`return (${telegraphChoice.toString()})`)() as typeof telegraphChoice;
    for (const c of [cornered({}), cornered({ hurt: true }), cornered({ exit: false, adjacentFoe: false }), cornered({ safeStep: true })]) {
      expect(rebuilt(c)).toBe(telegraphChoice(c));
    }
  });
});
