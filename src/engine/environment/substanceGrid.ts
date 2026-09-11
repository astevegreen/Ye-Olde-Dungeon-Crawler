import type { GameMap } from '../grid/map';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import { CorpseItemInstance } from '../items/corpse';

export const SubstanceBitmask = {
  NONE: 0,
  FLOWING_FLUID: 1 << 0,     // 1
  RADIANT_EXPOSURE: 1 << 1,  // 2
  PURIFIED_BARRIER: 1 << 2,  // 4
  IGNITED: 1 << 3,           // 8
} as const;

export interface SubstanceTickSummary {
  cellsProcessed: number;
  damageDealt: number;
  crematedCount: number;
}

export class SubstanceGrid {
  public readonly width: number;
  public readonly height: number;
  private cells: Map<string, number> = new Map();
  private activeCells: Set<string> = new Set();
  public maxTickBudget: number = 100;

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

  public addSubstance(x: number, y: number, mask: number): void {
    if (!this.inBounds(x, y) || mask === 0) return;
    const k = this.key(x, y);
    const existing = this.cells.get(k) ?? 0;
    const updated = existing | mask;
    this.cells.set(k, updated);
    this.activeCells.add(k);
  }

  public removeSubstance(x: number, y: number, mask: number): void {
    if (!this.inBounds(x, y)) return;
    const k = this.key(x, y);
    const existing = this.cells.get(k);
    if (existing === undefined) return;
    const updated = existing & ~mask;
    if (updated === 0) {
      this.cells.delete(k);
      this.activeCells.delete(k);
    } else {
      this.cells.set(k, updated);
    }
  }

  public getSubstances(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.cells.get(this.key(x, y)) ?? 0;
  }

  public hasSubstance(x: number, y: number, mask: number): boolean {
    return (this.getSubstances(x, y) & mask) === mask;
  }

  public clear(): void {
    this.cells.clear();
    this.activeCells.clear();
  }

  /**
   * Evaluates whether an entity can path into/through cell based on vulnerability tags.
   */
  public canTraverse(entity: Entity, x: number, y: number): boolean {
    const mask = this.getSubstances(x, y);
    if (mask === 0) return true;

    // Vulnerable to fluid currents cannot traverse flowing fluids
    if (
      (mask & SubstanceBitmask.FLOWING_FLUID) !== 0 &&
      entity.vulnerabilityTags.includes('vulnerableToCurrents')
    ) {
      return false;
    }

    // Incorporeal entities cannot path through purified barriers
    if (
      (mask & SubstanceBitmask.PURIFIED_BARRIER) !== 0 &&
      entity.vulnerabilityTags.includes('incorporeal')
    ) {
      return false;
    }

    return true;
  }

  /**
   * Environmental tick evaluating reactive substances on active cells.
   * Execution is bounded by maxTickBudget to guarantee O(K) headless performance.
   */
  public tickSubstances(map: GameMap, engine?: GameEngine): SubstanceTickSummary {
    let cellsProcessed = 0;
    let damageDealt = 0;
    let crematedCount = 0;

    for (const key of this.activeCells) {
      if (cellsProcessed >= this.maxTickBudget) {
        break;
      }
      cellsProcessed++;

      const [xStr, yStr] = key.split(',');
      const x = parseInt(xStr, 10);
      const y = parseInt(yStr, 10);
      const mask = this.cells.get(key) ?? 0;

      // 1. Radiant Exposure
      if ((mask & SubstanceBitmask.RADIANT_EXPOSURE) !== 0) {
        const entities = map.getEntitiesAt(x, y);
        for (const ent of entities) {
          if (ent.isAlive() && ent.vulnerabilityTags.includes('photophobic')) {
            const dmg = 3;
            const res = ent.takeElementalDamage(dmg, 'radiant');
            damageDealt += res.damageDealt;
            if (engine) {
              engine.log(
                `[Radiant Burn] ${ent.name} sears under intense light for ${res.damageDealt} damage!`
              );
            }
          }
        }
      }

      // 2. Ignited Thermal Cells
      if ((mask & SubstanceBitmask.IGNITED) !== 0) {
        const entities = map.getEntitiesAt(x, y);
        for (const ent of entities) {
          if (ent.isAlive()) {
            const dmg = 4;
            const res = ent.takeElementalDamage(dmg, 'fire');
            damageDealt += res.damageDealt;
            if (engine) {
              engine.log(`[Thermal Hazard] ${ent.name} takes ${res.damageDealt} fire damage from ignited flames!`);
            }
          }
        }

        // Cremate organic corpses into ash
        const groundItems = map.getItemsAt(x, y);
        for (const item of [...groundItems]) {
          if (item instanceof CorpseItemInstance && !item.isBurned) {
            item.cremate(map, x, y);
            crematedCount++;
            if (engine) {
              engine.log(`[Cremation] The corpse of ${item.archetypeId} is cremated into harmless ash!`);
            }
          }
        }
      }
    }

    return { cellsProcessed, damageDealt, crematedCount };
  }
}
