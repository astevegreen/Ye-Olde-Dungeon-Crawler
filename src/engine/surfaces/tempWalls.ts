import type { ActionResult, TileDefinition } from '../types';
import { BASE_ACTION_COST } from '../types';
import type { Entity } from '../entities/entity';
import { attributeScalingOf, strengthMeleeBonus } from '../combat/attributeScaling';
import type { GameEngine } from '../engine';
import type { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';

/**
 * Temporary walls (P-35): a cell turned into a real wall tile for a while, with its own HP.
 * The cell's tile is swapped for `TILES.WALL`, so movement, pathing, sight and shots treat it
 * as a wall with no change to their code; this table remembers the floor beneath and gives it
 * back when the wall's turns run out or its HP reaches 0, leaving rubble if the wall asks.
 */

/** What a wall leaves when it falls: a surface kind the pack defines, and how long it lasts. */
export interface TempWallRubble {
  kind: string;
  turns: number;
}

export interface TempWallSpec {
  hp: number;
  turns: number;
  /** What the log calls it ("the cairn"); "wall" when unset. */
  name?: string;
  rubble?: TempWallRubble;
}

interface TempWall extends TempWallSpec {
  maxHp: number;
  /** The tile the wall stands on, restored when it falls. */
  under: TileDefinition;
}

/** A wall as saved: the floor beneath goes in the tile grid, so it is not repeated here. */
export interface SerializedTempWall {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  turns: number;
  name?: string;
  rubble?: TempWallRubble;
}

const walkable = (tile: TileDefinition | null): boolean => !!tile && (tile.walkable ?? tile.passable);

export class TempWallTable {
  private readonly walls = new Map<string, TempWall>();

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  public has(x: number, y: number): boolean {
    return this.walls.has(this.key(x, y));
  }

  public get size(): number {
    return this.walls.size;
  }

  /** HP left on the wall at a cell, or undefined when there is none. */
  public hpAt(x: number, y: number): number | undefined {
    return this.walls.get(this.key(x, y))?.hp;
  }

  /** The floor a wall stands on, which is what the save writes for its cell. */
  public underAt(x: number, y: number): TileDefinition | undefined {
    return this.walls.get(this.key(x, y))?.under;
  }

  /**
   * Changes the floor beneath a standing wall (a trap spotted under it), which it gives back
   * when it falls. Returns false when no wall stands there.
   */
  public setUnder(x: number, y: number, tile: TileDefinition): boolean {
    const wall = this.walls.get(this.key(x, y));
    if (!wall) return false;
    wall.under = tile;
    return true;
  }

  /**
   * Raises a wall on a walkable cell. A creature standing there is shoved to a free walkable
   * neighbour; with none free, the wall is refused. Items stay under the wall; surfaces and gas
   * on the cell are cleared. Returns whether the wall rose.
   */
  public raise(map: GameMap, x: number, y: number, spec: TempWallSpec): boolean {
    if (this.has(x, y)) return false;
    const under = map.getTile(x, y);
    if (!under || !walkable(under)) return false;
    const occupant = map.getEntityAt(x, y);
    if (occupant) {
      const spot = freeNeighbour(map, x, y);
      if (!spot || !map.moveEntity(occupant, spot.x, spot.y)) return false;
    }
    map.surfaces.removeSurface(x, y);
    map.surfaces.removeGas(x, y);
    map.setTile(x, y, TILES.WALL);
    this.walls.set(this.key(x, y), { ...spec, maxHp: spec.hp, under });
    return true;
  }

  /**
   * Takes HP off the wall at a cell and logs it, felling the wall at 0. Returns false when no
   * wall stands there.
   */
  public damage(engine: GameEngine, x: number, y: number, amount: number): boolean {
    const wall = this.walls.get(this.key(x, y));
    if (!wall) return false;
    const dealt = Math.max(0, Math.round(amount));
    wall.hp -= dealt;
    const name = wall.name ?? 'wall';
    if (wall.hp <= 0) {
      engine.log(`The ${name} crumbles!`);
      this.fell(engine, x, y);
    } else {
      engine.log(`The ${name} takes ${dealt} damage (${wall.hp}/${wall.maxHp}).`);
    }
    return true;
  }

  /** One turn off every wall, felling those whose turns are spent. Run with the surface tick. */
  public tick(engine: GameEngine): void {
    for (const [k, wall] of Array.from(this.walls.entries())) {
      wall.turns -= 1;
      if (wall.turns <= 0) {
        const [x, y] = k.split(',').map(Number);
        this.fell(engine, x, y);
      }
    }
  }

  /** Gives the floor back, leaving the wall's rubble on it. */
  public fell(engine: GameEngine, x: number, y: number): void {
    const wall = this.walls.get(this.key(x, y));
    if (!wall) return;
    this.walls.delete(this.key(x, y));
    engine.map.setTile(x, y, wall.under);
    if (wall.rubble) engine.map.surfaces.laySurface(engine, x, y, wall.rubble.kind, wall.rubble.turns);
  }

  public serialize(): SerializedTempWall[] {
    return Array.from(this.walls.entries()).map(([k, w]) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y, hp: w.hp, maxHp: w.maxHp, turns: w.turns, name: w.name, rubble: w.rubble ? { ...w.rubble } : undefined };
    });
  }

  /** Re-raises saved walls over the floor the tile grid has just loaded. */
  public deserialize(map: GameMap, data: SerializedTempWall[]): void {
    this.walls.clear();
    if (!Array.isArray(data)) return;
    for (const w of data) {
      const under = map.getTile(w.x, w.y);
      if (!under) continue;
      map.setTile(w.x, w.y, TILES.WALL);
      this.walls.set(this.key(w.x, w.y), {
        hp: w.hp,
        maxHp: w.maxHp,
        turns: w.turns,
        name: w.name,
        rubble: w.rubble ? { ...w.rubble } : undefined,
        under,
      });
    }
  }
}

/**
 * A blow at a temporary wall: a turn spent, and the attacker's attack plus strength in damage.
 * Walls have no defense to take off and no dodge; a blow always lands.
 */
export function strikeTempWall(engine: GameEngine, attacker: Entity, x: number, y: number): ActionResult {
  const cost = attacker.getActionCost(BASE_ACTION_COST);
  attacker.consumeEnergy(cost);
  const amount = Math.max(1, attacker.attack + strengthMeleeBonus(attacker, attributeScalingOf(engine.manifest)));
  engine.map.tempWalls.damage(engine, x, y, amount);
  return { success: true, cost };
}

/** The first free walkable neighbour of a cell, orthogonal ones first. */
function freeNeighbour(map: GameMap, x: number, y: number): { x: number; y: number } | null {
  const steps = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]];
  for (const [dx, dy] of steps) {
    const nx = x + dx;
    const ny = y + dy;
    if (walkable(map.getTile(nx, ny)) && !map.getEntityAt(nx, ny)) return { x: nx, y: ny };
  }
  return null;
}
