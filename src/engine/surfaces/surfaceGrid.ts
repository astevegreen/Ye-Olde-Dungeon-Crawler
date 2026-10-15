import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { ElementType } from '../magic/elements';
import type { Position, TileType } from '../types';
import { applyImpulse } from '../combat/impulse';
import { DeathResolver } from '../combat/deathResolver';
import { builtinGasBlocksSight, surfaceBehaviourOf, type SurfaceMoment } from './surfaceBehaviours';

/** A behaviour's log line with `{name}` and `{n}` filled. */
function fillLine(line: string, name: string, n?: number): string {
  return line.replace(/\{name\}/g, name).replace(/\{n\}/g, String(n ?? ''));
}

export const BUILTIN_SURFACE_TYPES = ['water', 'oil_slick', 'acid_pool', 'ice_sheet', 'mud', 'fire'] as const;
export type SurfaceType = (typeof BUILTIN_SURFACE_TYPES)[number] | string;
/** The built-in gases (`surfaceBehaviours.ts`), or any a pack declares. */
export type GasType = 'fire_storm' | 'poison_cloud' | 'dense_steam' | string;

export interface SurfaceInstance {
  type: SurfaceType;
  duration: number; // Discrete turns remaining
  potency?: number;
}

export interface GasInstance {
  type: GasType;
  duration: number; // Discrete turns remaining
  potency?: number;
  /** Its sight rule, stamped by `layGas` where the pack's differs from the built-in one. */
  blocksSight?: boolean;
}

export interface CellSurfaces {
  surface?: SurfaceInstance;
  gas?: GasInstance;
}

export interface SerializedSurfaceCell {
  x: number;
  y: number;
  surface?: SurfaceInstance;
  gas?: GasInstance;
}

export interface ReactionResult {
  triggered: boolean;
  occurred: boolean;
  type?: 'ignite' | 'evaporate' | 'electrocute' | 'freeze' | 'melt' | 'douse';
  reactionName?: string;
  message?: string;
  affectedCells: Position[];
  damageDealt?: number;
}

/** The most tiles a pool shock or freeze reaches. */
const MAX_POOL_TILES = 50;

export class SurfaceGrid {
  public readonly width: number;
  public readonly height: number;
  private cells: Map<string, CellSurfaces> = new Map();
  /** One cast's reactions (`withReactionScope`): the tiles that have reacted, and the lines said. */
  private scope?: { tiles: Set<string>; lines: Set<string> };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  public getCell(x: number, y: number): CellSurfaces | undefined {
    if (!this.inBounds(x, y)) return undefined;
    return this.cells.get(this.key(x, y));
  }

  public getSurface(x: number, y: number): SurfaceType | undefined {
    return this.getCell(x, y)?.surface?.type;
  }

  public getGas(x: number, y: number): GasType | undefined {
    return this.getCell(x, y)?.gas?.type;
  }

  public setSurface(x: number, y: number, type: SurfaceType, duration = 8, potency = 1): void {
    if (!this.inBounds(x, y)) return;
    const k = this.key(x, y);
    const existing = this.cells.get(k) ?? {};
    existing.surface = { type, duration, potency };
    this.cells.set(k, existing);
  }

  public removeSurface(x: number, y: number): void {
    const k = this.key(x, y);
    const existing = this.cells.get(k);
    if (existing) {
      existing.surface = undefined;
      if (!existing.gas) {
        this.cells.delete(k);
      }
    }
  }

  public setGas(x: number, y: number, type: GasType, duration = 6, potency = 1): void {
    if (!this.inBounds(x, y)) return;
    const k = this.key(x, y);
    const existing = this.cells.get(k) ?? {};
    existing.gas = { type, duration, potency };
    this.cells.set(k, existing);
  }

  public removeGas(x: number, y: number): void {
    const k = this.key(x, y);
    const existing = this.cells.get(k);
    if (existing) {
      existing.gas = undefined;
      if (!existing.surface) {
        this.cells.delete(k);
      }
    }
  }

  public clear(): void {
    this.cells.clear();
  }

  /**
   * Returns false if an opaque gas (like dense steam) blocks line-of-sight: the sight rule stamped
   * on it when laid (`layGas`), else the built-in one.
   */
  public isTransparent(x: number, y: number): boolean {
    const gas = this.getCell(x, y)?.gas;
    if (!gas) return true;
    return !(gas.blocksSight ?? builtinGasBlocksSight(gas.type));
  }

  /**
   * Lays a gas with the pack's sight rule stamped on it where it differs from the built-in one,
   * so a save keeps it and line of sight, which has no engine to read the table from, needs nothing more.
   */
  public layGas(engine: GameEngine, x: number, y: number, type: GasType, duration?: number, potency?: number): void {
    this.setGas(x, y, type, duration, potency);
    const gas = this.getCell(x, y)?.gas;
    const blocks = surfaceBehaviourOf(engine, 'gas', type)?.blocksSight === true;
    if (gas && blocks !== builtinGasBlocksSight(type)) gas.blocksSight = blocks;
  }

  /**
   * Lays a ground surface where whatever lies there may answer it: water douses fire on the
   * ground and a firestorm above it. Returns the reaction, if one happened.
   */
  public laySurface(engine: GameEngine, x: number, y: number, type: SurfaceType, duration?: number, potency?: number): ReactionResult | undefined {
    const cell = this.getCell(x, y);
    const douses = type === 'water' && (cell?.surface?.type === 'fire' || cell?.gas?.type === 'fire_storm');
    if (douses && cell?.gas?.type === 'fire_storm') this.removeGas(x, y);
    this.setSurface(x, y, type, duration, potency);
    if (!douses) return undefined;
    const message = '*** The water douses the flames in a hiss of smoke! ***';
    this.say(engine, message);
    return { triggered: true, occurred: true, type: 'douse', reactionName: 'Dousing', message, affectedCells: [{ x, y }] };
  }

  /**
   * Runs `fn` as one cast's reactions: a tile reacts once (so a pool is shocked once however many
   * of its tiles a burst covers) and each reaction's line is said once.
   */
  public withReactionScope<T>(fn: () => T): T {
    if (this.scope) return fn();
    this.scope = { tiles: new Set(), lines: new Set() };
    try {
      return fn();
    } finally {
      this.scope = undefined;
    }
  }

  /** A reaction's line, said once in a cast's scope. */
  private say(engine: GameEngine, line: string): void {
    if (this.scope) {
      if (this.scope.lines.has(line)) return;
      this.scope.lines.add(line);
    }
    engine.log(line);
  }

  /** The water a pool shock or freeze spreads through: laid water or shallow water. */
  private isWaterAt(engine: GameEngine, x: number, y: number): boolean {
    return this.getCell(x, y)?.surface?.type === 'water' || engine.map.getTile(x, y)?.type === 'shallow_water';
  }

  /**
   * The ground a struck creature stands on, for the water rule of `calculateElementalDamage`:
   * laid water counts as shallow water, so a wader in either takes lightning at 200% once.
   */
  public terrainAt(engine: GameEngine, x: number, y: number): TileType | undefined {
    return this.isWaterAt(engine, x, y) ? 'shallow_water' : engine.map.getTile(x, y)?.type;
  }

  /** The tiles of the pool at (x, y), 4-way, at most `max`. */
  private poolAt(engine: GameEngine, x: number, y: number, max: number): Position[] {
    const pool: Position[] = [];
    const queue: Position[] = [{ x, y }];
    const visited = new Set<string>();
    while (queue.length > 0 && pool.length < max) {
      const p = queue.shift()!;
      const k = this.key(p.x, p.y);
      if (visited.has(k)) continue;
      visited.add(k);
      if (!this.inBounds(p.x, p.y) || !this.isWaterAt(engine, p.x, p.y)) continue;
      pool.push(p);
      queue.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
    }
    return pool;
  }

  /**
   * What stepping onto this tile does, by its surface's then its gas's `enter` behaviour
   * (`surfaceBehaviours.ts`): a hurt, a status, a line, extra energy, a slide along (dx, dy).
   * A gas acts only on a mover the surface did not slide away.
   */
  public handleEntityStep(
    entity: Entity,
    x: number,
    y: number,
    dx: number,
    dy: number,
    engine: GameEngine
  ): { slid: boolean; energyPenalty: number } {
    const cell = this.getCell(x, y);
    let slid = false;
    let energyPenalty = 0;
    if (!cell) return { slid, energyPenalty };

    const layers: { layer: 'surface' | 'gas'; type?: string }[] = [
      { layer: 'surface', type: cell.surface?.type },
      { layer: 'gas', type: cell.gas?.type },
    ];
    for (const { layer, type } of layers) {
      if (type === undefined || slid) continue;
      const enter = surfaceBehaviourOf(engine, layer, type)?.enter;
      if (!enter) continue;
      energyPenalty += enter.moveCost ?? 0;
      this.actOn(engine, entity, enter);
      if (enter.slide && (dx !== 0 || dy !== 0) && entity.isAlive()) {
        if (applyImpulse(engine, undefined, entity, dx, dy, enter.slide).pushed) slid = true;
      }
    }

    return { slid, energyPenalty };
  }

  /**
   * A creature put down where it stands by something else (a shove, a pull, a slide, a
   * teleport, a swap) meets that tile as if it stepped there, but slides no farther and
   * pays no move cost: the move was not its own.
   */
  public landOn(engine: GameEngine, entity: Entity): void {
    if (!entity.isAlive()) return;
    this.handleEntityStep(entity, entity.x, entity.y, 0, 0, engine);
  }

  /** One moment of a surface or gas on a living creature: its hurt, its status, its line. */
  private actOn(engine: GameEngine, entity: Entity, moment: SurfaceMoment): void {
    if (!entity.isAlive()) return;
    const { harm, status, line } = moment;
    if (harm) {
      this.harm(engine, entity, harm.amount, harm.element, harm.cause, (n) => fillLine(harm.line, entity.name, n));
    }
    if (status && entity.isAlive()) {
      entity.statusManager.applyStatus(
        { type: status.type, duration: status.duration, potency: status.potency ?? 1 },
        entity.statusImmunities,
        entity,
        engine
      );
    }
    if (line) engine.log(fillLine(line, entity.name));
  }

  /**
   * Ground and gas damage by element, through the entity's affinity: its resistances, and
   * for an Actor what it wears and the perks it holds (`Actor.affinityTo`). So what resists
   * fire resists burning ground, and a fire-immune creature walks its own trail unharmed.
   * Logs the hurt line, or that the entity was unharmed or healed, and resolves a death,
   * named `cause` on the death screen ("Slain by searing fire").
   */
  private harm(engine: GameEngine, entity: Entity, amount: number, element: ElementType, cause: string, hurtLine: (dealt: number) => string): number {
    const res = entity.takeElementalDamage(amount, element, engine.affinityMatrix);
    if (res.isHeal) engine.log(`${entity.name} is healed by the ${element} for ${res.healed}.`);
    else if (res.damageDealt === 0 && !res.killed) engine.log(`${entity.name} is unharmed by the ${element}.`);
    else engine.log(hurtLine(res.damageDealt));
    if (res.killed) DeathResolver.resolveDeath(engine, undefined, entity, { cause });
    return res.damageDealt;
  }

  /**
   * Evaluates elemental interactions when fire, lightning, cold, or acid strikes a tile.
   * In a cast's scope (`withReactionScope`) a tile that has reacted does not react again.
   * `struck` already took the blow, the water's share included, so a pool shock passes it over.
   */
  public triggerElementalReaction(
    x: number,
    y: number,
    element: ElementType | string,
    damageOrEngine: number | GameEngine,
    engineMaybe?: GameEngine,
    struck?: Entity
  ): ReactionResult {
    let baseDamage = 10;
    let engine: GameEngine;
    if (typeof damageOrEngine === 'number') {
      baseDamage = damageOrEngine;
      engine = engineMaybe!;
    } else {
      engine = damageOrEngine;
    }
    if (this.scope?.tiles.has(this.key(x, y))) return { triggered: false, occurred: false, affectedCells: [] };
    const result = this.react(x, y, element, baseDamage, engine, struck);
    if (this.scope && result.occurred) {
      this.scope.tiles.add(this.key(x, y));
      for (const p of result.affectedCells) this.scope.tiles.add(this.key(p.x, p.y));
    }
    return result;
  }

  private react(x: number, y: number, element: ElementType | string, baseDamage: number, engine: GameEngine, struck?: Entity): ReactionResult {
    const cell = this.getCell(x, y);
    const tile = engine.map.getTile(x, y);
    const isWater = cell?.surface?.type === 'water' || tile?.type === 'shallow_water';
    const isOil = cell?.surface?.type === 'oil_slick';
    const isIce = cell?.surface?.type === 'ice_sheet';

    const normalizedElement = element.toLowerCase();

    // ── Reaction 1: Oil Slick + Fire -> Ignites into FireStorm and spreads ──
    if (isOil && (normalizedElement === 'fire' || normalizedElement === 'heat')) {
      const affectedCells: Position[] = [];
      const queue: Position[] = [{ x, y }];
      const visited = new Set<string>();

      while (queue.length > 0) {
        const p = queue.shift()!;
        const k = this.key(p.x, p.y);
        if (visited.has(k)) continue;
        visited.add(k);

        const currentCell = this.getCell(p.x, p.y);
        if (currentCell?.surface?.type === 'oil_slick') {
          this.removeSurface(p.x, p.y);
          this.layGas(engine, p.x, p.y, 'fire_storm', 4, 8);
          affectedCells.push(p);

          // Burn standing entities
          const ent = engine.map.getEntityAt(p.x, p.y);
          if (ent && ent.isAlive()) {
            this.harm(engine, ent, Math.max(6, Math.floor(baseDamage * 0.8)), 'fire', 'burning oil', (n) => `${ent.name} is engulfed in the ignited oil inferno for ${n} fire damage!`);
          }

          // Spread to 4-way adjacent oil cells
          const neighbors = [
            { x: p.x + 1, y: p.y },
            { x: p.x - 1, y: p.y },
            { x: p.x, y: p.y + 1 },
            { x: p.x, y: p.y - 1 },
          ];
          for (const n of neighbors) {
            if (this.inBounds(n.x, n.y) && !visited.has(this.key(n.x, n.y))) {
              if (this.getCell(n.x, n.y)?.surface?.type === 'oil_slick') {
                queue.push(n);
              }
            }
          }
        }
      }

      const msg = `*** The oil slick catches fire and erupts into a spreading FireStorm inferno! ***`;
      this.say(engine, msg);
      return {
        triggered: true,
        occurred: true,
        type: 'ignite',
        reactionName: 'Ignition',
        message: msg,
        affectedCells,
      };
    }

    // ── Fire on ice: melts to water ──
    if (isIce && (normalizedElement === 'fire' || normalizedElement === 'heat')) {
      this.setSurface(x, y, 'water', 8, 1);
      const msg = `*** The ice sheet melts away into water! ***`;
      this.say(engine, msg);
      return { triggered: true, occurred: true, type: 'melt', reactionName: 'Melting', message: msg, affectedCells: [{ x, y }] };
    }

    // ── Reaction 2: Water + Fire -> Evaporates into DenseSteam ──
    if (isWater && (normalizedElement === 'fire' || normalizedElement === 'heat')) {
      if (cell?.surface?.type === 'water') {
        this.removeSurface(x, y);
      }
      this.layGas(engine, x, y, 'dense_steam', 5, 1);
      const msg = `*** The water boils furiously, releasing a billowing cloud of dense steam! ***`;
      this.say(engine, msg);
      return {
        triggered: true,
        occurred: true,
        type: 'evaporate',
        reactionName: 'Vaporization',
        message: msg,
        affectedCells: [{ x, y }],
      };
    }

    // ── Reaction 3: Water + Lightning -> Electrocutes entire contiguous pool ──
    if (isWater && (normalizedElement === 'lightning' || normalizedElement === 'electric')) {
      const affectedCells: Position[] = [];
      const queue: Position[] = [{ x, y }];
      const visited = new Set<string>();
      let totalDmg = 0;

      while (queue.length > 0 && affectedCells.length < MAX_POOL_TILES) {
        const p = queue.shift()!;
        const k = this.key(p.x, p.y);
        if (visited.has(k)) continue;
        visited.add(k);

        const currentTile = engine.map.getTile(p.x, p.y);
        const currentCell = this.getCell(p.x, p.y);
        const cellIsWater = currentCell?.surface?.type === 'water' || currentTile?.type === 'shallow_water';

        if (cellIsWater) {
          affectedCells.push(p);

          // Electrocute wading entity for 200% lightning damage
          const ent = engine.map.getEntityAt(p.x, p.y);
          if (ent && ent !== struck && ent.isAlive()) {
            // The 200% is this pool's; no terrain is passed, so the water rule doesn't double it again.
            const electroDamage = Math.max(10, Math.round(baseDamage * 2.0));
            totalDmg += this.harm(
              engine,
              ent,
              electroDamage,
              'lightning',
              'lightning',
              (n) => `*** Lightning courses through the water! ${ent.name} is severely shocked for ${n} electrocution damage (200%)! ***`
            );
          }

          // Flood-fill adjacent 4-directional tiles
          const neighbors = [
            { x: p.x + 1, y: p.y },
            { x: p.x - 1, y: p.y },
            { x: p.x, y: p.y + 1 },
            { x: p.x, y: p.y - 1 },
          ];
          for (const n of neighbors) {
            if (this.inBounds(n.x, n.y) && !visited.has(this.key(n.x, n.y))) {
              const nTile = engine.map.getTile(n.x, n.y);
              const nCell = this.getCell(n.x, n.y);
              if (nCell?.surface?.type === 'water' || nTile?.type === 'shallow_water') {
                queue.push(n);
              }
            }
          }
        }
      }

      const msg = `*** Lightning surges through the connected water pool, shocking everything wading within! ***`;
      this.say(engine, msg);
      return {
        triggered: true,
        occurred: true,
        type: 'electrocute',
        reactionName: 'Electrocution',
        message: msg,
        affectedCells,
        damageDealt: totalDmg,
      };
    }

    // ── Reaction 4: Water + Cold/Frost -> Freezes into IceSheet ──
    if (isWater && (normalizedElement === 'cold' || normalizedElement === 'frost' || normalizedElement === 'ice')) {
      const pool = this.poolAt(engine, x, y, MAX_POOL_TILES);
      for (const p of pool) this.setSurface(p.x, p.y, 'ice_sheet', 6, 1);
      const msg = `*** The water flash-freezes into a slick sheet of ice! ***`;
      this.say(engine, msg);
      return {
        triggered: true,
        occurred: true,
        type: 'freeze',
        reactionName: 'Freezing',
        message: msg,
        affectedCells: pool,
      };
    }

    return { triggered: false, occurred: false, affectedCells: [] };
  }

  /**
   * Discrete turn ticking for decaying surfaces and gasses: each layer loses a turn, then acts on
   * whoever stands in it (its `standing` behaviour), ground first.
   */
  public tick(engine: GameEngine): void {
    const keys = Array.from(this.cells.keys());

    for (const k of keys) {
      const cell = this.cells.get(k);
      if (!cell) continue;
      const [xStr, yStr] = k.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);

      const entity = engine.map.getEntityAt(x, y);

      if (cell.surface) {
        cell.surface.duration -= 1;
        const standing = surfaceBehaviourOf(engine, 'surface', cell.surface.type)?.standing;
        if (entity && standing) this.actOn(engine, entity, standing);
        if (cell.surface.duration <= 0) {
          cell.surface = undefined;
        }
      }

      if (cell.gas) {
        cell.gas.duration -= 1;
        const standing = surfaceBehaviourOf(engine, 'gas', cell.gas.type)?.standing;
        if (entity && standing) this.actOn(engine, entity, standing);
        if (cell.gas.duration <= 0) {
          cell.gas = undefined;
        }
      }

      if (!cell.surface && !cell.gas) {
        this.cells.delete(k);
      }
    }
  }

  /**
   * Serializes all active surfaces and gasses.
   */
  public serialize(): SerializedSurfaceCell[] {
    const list: SerializedSurfaceCell[] = [];
    for (const [k, cell] of this.cells.entries()) {
      const [xStr, yStr] = k.split(',');
      list.push({
        x: parseInt(xStr, 10),
        y: parseInt(yStr, 10),
        surface: cell.surface ? { ...cell.surface } : undefined,
        gas: cell.gas ? { ...cell.gas } : undefined,
      });
    }
    return list;
  }

  /**
   * Deserializes surface cells.
   */
  public deserialize(data: SerializedSurfaceCell[]): void {
    this.cells.clear();
    if (!Array.isArray(data)) return;
    for (const item of data) {
      if (this.inBounds(item.x, item.y)) {
        this.cells.set(this.key(item.x, item.y), {
          surface: item.surface ? { ...item.surface } : undefined,
          gas: item.gas ? { ...item.gas } : undefined,
        });
      }
    }
  }

  public getAllActiveCells(): { x: number; y: number; cell: CellSurfaces }[] {
    const results: { x: number; y: number; cell: CellSurfaces }[] = [];
    for (const [k, cell] of this.cells.entries()) {
      const [xStr, yStr] = k.split(',');
      results.push({
        x: parseInt(xStr, 10),
        y: parseInt(yStr, 10),
        cell,
      });
    }
    return results;
  }
}
