import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { ElementType } from '../magic/elements';
import type { Position } from '../types';
import { applyImpulse } from '../combat/impulse';
import { DeathResolver } from '../combat/deathResolver';

export type SurfaceType = 'water' | 'oil_slick' | 'acid_pool' | 'ice_sheet' | 'mud' | 'fire' | string;
export const BUILTIN_SURFACE_TYPES = ['water', 'oil_slick', 'acid_pool', 'ice_sheet', 'mud', 'fire'] as const;
export type GasType = 'fire_storm' | 'poison_cloud' | 'dense_steam';

export interface SurfaceInstance {
  type: SurfaceType;
  duration: number; // Discrete turns remaining
  potency?: number;
}

export interface GasInstance {
  type: GasType;
  duration: number; // Discrete turns remaining
  potency?: number;
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
  type?: 'ignite' | 'evaporate' | 'electrocute' | 'freeze';
  reactionName?: string;
  message?: string;
  affectedCells: Position[];
  damageDealt?: number;
}

export class SurfaceGrid {
  public readonly width: number;
  public readonly height: number;
  private cells: Map<string, CellSurfaces> = new Map();

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
   * Returns false if an opaque gas (like dense steam) blocks line-of-sight.
   */
  public isTransparent(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    if (cell?.gas?.type === 'dense_steam') {
      return false;
    }
    return true;
  }

  /**
   * Checks if an entity standing on or stepping into this tile triggers water, ice, acid, or oil effects.
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

    // 1. Ice Sheet: Slide 2 tiles along movement vector with energy penalty (+50)
    if (cell.surface?.type === 'ice_sheet') {
      energyPenalty += 50;
      engine.log(`${entity.name} slips on the slick ice sheet!`);
      if (dx !== 0 || dy !== 0) {
        const slideRes = applyImpulse(engine, undefined, entity, dx, dy, 2);
        if (slideRes.pushed) {
          slid = true;
        }
      }
    }

    // 2. Acid Pool: Deals immediate acid damage
    if (cell.surface?.type === 'acid_pool' && entity.isAlive()) {
      const { damageDealt, killed } = entity.takeDamage(4);
      engine.log(`${entity.name} wades into caustic acid for ${damageDealt} acid damage!`);
      if (killed) {
        DeathResolver.resolveDeath(engine, undefined, entity);
      }
    }

    // 3. Oil Slick: Slippery ground
    if (cell.surface?.type === 'oil_slick') {
      engine.log(`${entity.name} treads carefully across the flammable oil slick.`);
    }

    // 4. Mud: Sticky terrain slowing movement
    if (cell.surface?.type === 'mud') {
      energyPenalty += 50;
      engine.log(`${entity.name} struggles through thick, clinging mud!`);
    }

    // 5. Fire: Burning ground dealing immediate fire damage
    if (cell.surface?.type === 'fire' && entity.isAlive()) {
      const { damageDealt, killed } = entity.takeDamage(4);
      engine.log(`${entity.name} steps into searing fire for ${damageDealt} fire damage!`);
      if (killed) {
        DeathResolver.resolveDeath(engine, undefined, entity);
      }
    }

    return { slid, energyPenalty };
  }

  /**
   * Evaluates elemental interactions when fire, lightning, cold, or acid strikes a tile.
   */
  public triggerElementalReaction(
    x: number,
    y: number,
    element: ElementType | string,
    damageOrEngine: number | GameEngine,
    engineMaybe?: GameEngine
  ): ReactionResult {
    let baseDamage = 10;
    let engine: GameEngine;
    if (typeof damageOrEngine === 'number') {
      baseDamage = damageOrEngine;
      engine = engineMaybe!;
    } else {
      engine = damageOrEngine;
    }

    const cell = this.getCell(x, y);
    const tile = engine.map.getTile(x, y);
    const isWater = cell?.surface?.type === 'water' || tile?.type === 'shallow_water';
    const isOil = cell?.surface?.type === 'oil_slick';

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
          this.setGas(p.x, p.y, 'fire_storm', 4, 8);
          affectedCells.push(p);

          // Burn standing entities
          const ent = engine.map.getEntityAt(p.x, p.y);
          if (ent && ent.isAlive()) {
            const { damageDealt, killed } = ent.takeDamage(Math.max(6, Math.floor(baseDamage * 0.8)));
            engine.log(`${ent.name} is engulfed in the ignited oil inferno for ${damageDealt} fire damage!`);
            if (killed) {
              DeathResolver.resolveDeath(engine, undefined, ent);
            }
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
      engine.log(msg);
      return {
        triggered: true,
        occurred: true,
        type: 'ignite',
        reactionName: 'Ignition',
        message: msg,
        affectedCells,
      };
    }

    // ── Reaction 2: Water + Fire -> Evaporates into DenseSteam ──
    if (isWater && (normalizedElement === 'fire' || normalizedElement === 'heat')) {
      if (cell?.surface?.type === 'water') {
        this.removeSurface(x, y);
      }
      this.setGas(x, y, 'dense_steam', 5, 1);
      const msg = `*** The water boils furiously, releasing a billowing cloud of dense steam! ***`;
      engine.log(msg);
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

      while (queue.length > 0) {
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
          if (ent && ent.isAlive()) {
            const electroDamage = Math.max(10, Math.round(baseDamage * 2.0));
            const { damageDealt, killed } = ent.takeDamage(electroDamage);
            totalDmg += damageDealt;
            engine.log(`*** Lightning courses through the water! ${ent.name} is severely shocked for ${damageDealt} electrocution damage (200%)! ***`);
            if (killed) {
              DeathResolver.resolveDeath(engine, undefined, ent);
            }
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
      engine.log(msg);
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
      if (cell?.surface?.type === 'water') {
        this.removeSurface(x, y);
      }
      this.setSurface(x, y, 'ice_sheet', 6, 1);
      const msg = `*** The water flash-freezes into a slick sheet of ice! ***`;
      engine.log(msg);
      return {
        triggered: true,
        occurred: true,
        type: 'freeze',
        reactionName: 'Freezing',
        message: msg,
        affectedCells: [{ x, y }],
      };
    }

    return { triggered: false, occurred: false, affectedCells: [] };
  }

  /**
   * Discrete turn ticking for decaying surfaces and gasses.
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

      // 1. Surface Decay & Periodic Effects
      if (cell.surface) {
        cell.surface.duration -= 1;

        if (entity && entity.isAlive()) {
          if (cell.surface.type === 'acid_pool') {
            const { damageDealt, killed } = entity.takeDamage(3);
            engine.log(`${entity.name} suffers ${damageDealt} acid burn from the caustic pool.`);
            if (killed) DeathResolver.resolveDeath(engine, undefined, entity);
          } else if (cell.surface.type === 'fire') {
            const { damageDealt, killed } = entity.takeDamage(3);
            engine.log(`${entity.name} is scorched by lingering fire for ${damageDealt} damage.`);
            if (killed) DeathResolver.resolveDeath(engine, undefined, entity);
          }
        }

        if (cell.surface.duration <= 0) {
          cell.surface = undefined;
        }
      }

      // 2. Gas Decay & Periodic Effects
      if (cell.gas) {
        cell.gas.duration -= 1;

        if (entity && entity.isAlive()) {
          if (cell.gas.type === 'fire_storm') {
            const { damageDealt, killed } = entity.takeDamage(5);
            engine.log(`${entity.name} burns inside the raging FireStorm for ${damageDealt} damage!`);
            if (killed) DeathResolver.resolveDeath(engine, undefined, entity);
          } else if (cell.gas.type === 'poison_cloud') {
            entity.statusManager.applyStatus(
              { type: 'poison', duration: 3, potency: 2 },
              entity.statusImmunities,
              entity,
              engine
            );
            engine.log(`${entity.name} chokes on noxious poison fumes!`);
          }
        }

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
