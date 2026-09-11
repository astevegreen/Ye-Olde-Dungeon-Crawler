import type { GameMap } from '../grid/map';
import type { Entity } from '../entities/entity';
import type { Position } from '../types';
import type { GameEngine } from '../engine';
import {
  type PlaneState,
  DEFAULT_PHYSICAL_PLANE,
  DEFAULT_LIMINAL_PLANE,
} from '../spatial/planeTypes';

export interface DriftTickResult {
  displacedCount: number;
  attritionDamageTotal: number;
}

export class PlaneManager {
  private planes = new Map<string, PlaneState>();

  constructor(initialPlanes?: PlaneState[]) {
    if (initialPlanes && initialPlanes.length > 0) {
      for (const p of initialPlanes) {
        this.planes.set(p.id, { ...p });
      }
    } else {
      this.planes.set(DEFAULT_PHYSICAL_PLANE.id, { ...DEFAULT_PHYSICAL_PLANE });
      this.planes.set(DEFAULT_LIMINAL_PLANE.id, { ...DEFAULT_LIMINAL_PLANE });
    }
  }

  public registerPlane(plane: PlaneState): void {
    this.planes.set(plane.id, { ...plane });
  }

  public getPlane(planeId: string): PlaneState | undefined {
    return this.planes.get(planeId);
  }

  public hasPlane(planeId: string): boolean {
    return this.planes.has(planeId);
  }

  public getAllPlanes(): PlaneState[] {
    return Array.from(this.planes.values());
  }

  /**
   * Transfers an entity between spatial planes.
   */
  public transferEntity(
    map: GameMap,
    entity: Entity,
    targetPlaneId: string,
    targetPos?: Position
  ): boolean {
    if (!this.planes.has(targetPlaneId)) {
      return false;
    }
    return map.changeEntityPlane(entity, targetPlaneId, targetPos?.x, targetPos?.y);
  }

  /**
   * Evaluates liminal fluid drift on all applicable planes for the given tick.
   * Entities without isAnchored = true are shifted along their plane's driftVector.
   * Blocked entities suffer progressive vitality attrition damage.
   */
  public tickDrift(map: GameMap, currentTick: number, engine?: GameEngine): DriftTickResult {
    let displacedCount = 0;
    let attritionDamageTotal = 0;

    for (const plane of this.planes.values()) {
      if (!plane.driftVector) continue;
      const { dx, dy, intervalTicks } = plane.driftVector;
      if (intervalTicks <= 0 || currentTick % intervalTicks !== 0) continue;

      const planeEntities = map.getAllEntities(plane.id);
      for (const entity of planeEntities) {
        if (!entity.isAlive() || entity.isAnchored) continue;

        const targetX = entity.x + dx;
        const targetY = entity.y + dy;

        const isPassable = map.isPassable(targetX, targetY);
        const occupied = map.getEntityAt(targetX, targetY, plane.id) !== null;

        if (isPassable && !occupied) {
          const moved = map.moveEntity(entity, targetX, targetY);
          if (moved) {
            displacedCount++;
          }
        } else {
          // Blocked by fluid compression: take progressive vitality attrition
          const attritionDmg = 2;
          entity.takeDamage(attritionDmg);
          attritionDamageTotal += attritionDmg;
          if (engine) {
            engine.log(
              `[Drift Attrition] ${entity.name} is battered against the ${plane.name} boundary for ${attritionDmg} damage!`
            );
          }
        }
      }
    }

    return { displacedCount, attritionDamageTotal };
  }

  public serialize(): Record<string, PlaneState> {
    const result: Record<string, PlaneState> = {};
    for (const [id, plane] of this.planes.entries()) {
      result[id] = {
        ...plane,
        driftVector: plane.driftVector ? { ...plane.driftVector } : undefined,
      };
    }
    return result;
  }

  public deserialize(data: Record<string, PlaneState>): void {
    this.planes.clear();
    for (const [id, plane] of Object.entries(data)) {
      this.planes.set(id, {
        ...plane,
        driftVector: plane.driftVector ? { ...plane.driftVector } : undefined,
      });
    }
  }
}
