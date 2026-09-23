import type { TileDefinition } from '../types';
import { itemIndex } from '../items/itemIndex';
import type { Entity } from '../entities/entity';
import type { Item } from '../items/item';
import type { TrapInstance } from '../dungeon/traps';
import { TILES } from './tile';
import { SurfaceGrid } from '../surfaces/surfaceGrid';
import { SubstanceGrid } from '../environment/substanceGrid';

export class GameMap {
  public readonly width: number;
  public readonly height: number;
  public readonly tiles: TileDefinition[][];
  private entities: Map<string, Entity>;
  private spatialIndex: Map<string, Entity>;
  private entityBuckets: Map<string, Entity[]>;
  private groundItems: Map<string, Item[]>;
  private traps: Map<string, TrapInstance>;
  public surfaces: SurfaceGrid;
  public substances: SubstanceGrid;
  public lastVisitedTick: number = 0;
  public floorTurnCount: number = 0;
  public isCleared: boolean = false;
  public lastRespawnTurn: number = 0;

  constructor(width: number, height: number, defaultTile: TileDefinition = TILES.WALL) {
    if (width <= 0 || height <= 0) {
      throw new Error(`Invalid map dimensions: ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    this.entities = new Map();
    this.spatialIndex = new Map();
    this.entityBuckets = new Map();
    this.groundItems = new Map();
    this.traps = new Map();
    this.surfaces = new SurfaceGrid(width, height);
    this.substances = new SubstanceGrid(width, height);

    this.tiles = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => defaultTile)
    );
  }

  private posKey(x: number, y: number, planeId = 'physical'): string {
    return `${planeId}:${x},${y}`;
  }

  private coordKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  public inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  public getTile(x: number, y: number): TileDefinition | null {
    if (!this.inBounds(x, y)) {
      return null;
    }
    return this.tiles[y][x];
  }

  public setTile(x: number, y: number, tile: TileDefinition): boolean {
    if (!this.inBounds(x, y)) {
      return false;
    }
    this.tiles[y][x] = tile;
    return true;
  }

  public fill(tile: TileDefinition): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.tiles[y][x] = tile;
      }
    }
  }

  public isPassable(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    return tile !== null && tile.passable;
  }

  public isTransparent(x: number, y: number, planeId = 'physical'): boolean {
    const tile = this.getTile(x, y);
    if (tile === null || !tile.transparent) return false;
    if (this.surfaces && !this.surfaces.isTransparent(x, y)) return false;
    const ent = this.getEntityAt(x, y, planeId);
    if (ent?.capabilities?.blocksLos) return false;
    return true;
  }

  public getEntityAt(x: number, y: number, planeId = 'physical'): Entity | null {
    return this.spatialIndex.get(this.posKey(x, y, planeId)) ?? null;
  }

  public getEntitiesAt(x: number, y: number): Entity[] {
    return this.entityBuckets.get(this.coordKey(x, y)) ?? [];
  }

  public getEntityById(id: string): Entity | null {
    return this.entities.get(id) ?? null;
  }

  public getAllEntities(planeId?: string): Entity[] {
    const all = Array.from(this.entities.values());
    if (planeId !== undefined) {
      return all.filter((e) => (e.planeId ?? 'physical') === planeId);
    }
    return all;
  }

  public addEntity(entity: Entity): boolean {
    if (!this.inBounds(entity.x, entity.y)) {
      return false;
    }
    const key = this.posKey(entity.x, entity.y, entity.planeId);
    if (this.spatialIndex.has(key)) {
      return false;
    }
    this.entities.set(entity.id, entity);
    this.spatialIndex.set(key, entity);

    const cKey = this.coordKey(entity.x, entity.y);
    let bucket = this.entityBuckets.get(cKey);
    if (!bucket) {
      bucket = [];
      this.entityBuckets.set(cKey, bucket);
    }
    bucket.push(entity);
    return true;
  }

  public removeEntity(entity: Entity): boolean {
    if (!this.entities.has(entity.id)) {
      return false;
    }
    this.entities.delete(entity.id);
    const key = this.posKey(entity.x, entity.y, entity.planeId);
    const current = this.spatialIndex.get(key);
    if (current && current.id === entity.id) {
      this.spatialIndex.delete(key);
    }

    const cKey = this.coordKey(entity.x, entity.y);
    const bucket = this.entityBuckets.get(cKey);
    if (bucket) {
      const idx = bucket.findIndex((e) => e.id === entity.id);
      if (idx !== -1) bucket.splice(idx, 1);
      if (bucket.length === 0) this.entityBuckets.delete(cKey);
    }
    return true;
  }

  public moveEntity(entity: Entity, targetX: number, targetY: number): boolean {
    if (!this.entities.has(entity.id)) {
      return false;
    }
    if (!this.inBounds(targetX, targetY)) {
      return false;
    }
    const targetKey = this.posKey(targetX, targetY, entity.planeId);
    if (this.spatialIndex.has(targetKey)) {
      return false;
    }

    const currentKey = this.posKey(entity.x, entity.y, entity.planeId);
    this.spatialIndex.delete(currentKey);

    const oldCKey = this.coordKey(entity.x, entity.y);
    const oldBucket = this.entityBuckets.get(oldCKey);
    if (oldBucket) {
      const idx = oldBucket.findIndex((e) => e.id === entity.id);
      if (idx !== -1) oldBucket.splice(idx, 1);
      if (oldBucket.length === 0) this.entityBuckets.delete(oldCKey);
    }

    entity.setPosition(targetX, targetY);
    this.spatialIndex.set(targetKey, entity);

    const newCKey = this.coordKey(targetX, targetY);
    let newBucket = this.entityBuckets.get(newCKey);
    if (!newBucket) {
      newBucket = [];
      this.entityBuckets.set(newCKey, newBucket);
    }
    newBucket.push(entity);
    return true;
  }

  public changeEntityPlane(
    entity: Entity,
    newPlaneId: string,
    targetX?: number,
    targetY?: number
  ): boolean {
    if (!this.entities.has(entity.id)) {
      return false;
    }
    const destX = targetX ?? entity.x;
    const destY = targetY ?? entity.y;
    if (!this.inBounds(destX, destY)) {
      return false;
    }
    const targetKey = this.posKey(destX, destY, newPlaneId);
    if (this.spatialIndex.has(targetKey)) {
      return false;
    }

    const oldKey = this.posKey(entity.x, entity.y, entity.planeId);
    this.spatialIndex.delete(oldKey);

    if (destX !== entity.x || destY !== entity.y) {
      const oldCKey = this.coordKey(entity.x, entity.y);
      const oldBucket = this.entityBuckets.get(oldCKey);
      if (oldBucket) {
        const idx = oldBucket.findIndex((e) => e.id === entity.id);
        if (idx !== -1) oldBucket.splice(idx, 1);
        if (oldBucket.length === 0) this.entityBuckets.delete(oldCKey);
      }

      const newCKey = this.coordKey(destX, destY);
      let newBucket = this.entityBuckets.get(newCKey);
      if (!newBucket) {
        newBucket = [];
        this.entityBuckets.set(newCKey, newBucket);
      }
      newBucket.push(entity);
    }

    entity.planeId = newPlaneId;
    entity.setPosition(destX, destY);
    this.spatialIndex.set(targetKey, entity);
    return true;
  }

  public getItemsAt(x: number, y: number): Item[] {
    return this.groundItems.get(this.posKey(x, y)) ?? [];
  }

  public addItemAt(x: number, y: number, item: Item): boolean {
    if (!this.inBounds(x, y)) return false;
    const key = this.posKey(x, y);
    const existing = this.groundItems.get(key) ?? [];
    existing.push(item);
    this.groundItems.set(key, existing);
    itemIndex.register(item, { kind: 'ground', x, y });
    return true;
  }

  public removeItemAt(x: number, y: number, itemId: string): Item | null {
    const key = this.posKey(x, y);
    const existing = this.groundItems.get(key);
    if (!existing) return null;
    const idx = existing.findIndex((i) => i.id === itemId);
    if (idx === -1) return null;
    const [item] = existing.splice(idx, 1);
    if (existing.length === 0) {
      this.groundItems.delete(key);
    }
    if (item) itemIndex.unregister(item.id);
    return item;
  }

  /** Index sizes for the diagnostics panel. */
  public getIndexStats(): { spatialIndexEntries: number; entityBuckets: number } {
    return { spatialIndexEntries: this.spatialIndex.size, entityBuckets: this.entityBuckets.size };
  }

  public getAllGroundItems(): Array<{ x: number; y: number; items: Item[] }> {
    const result: Array<{ x: number; y: number; items: Item[] }> = [];
    for (const [key, items] of this.groundItems.entries()) {
      // Keys are plane-qualified — `${planeId}:${x},${y}` (posKey, ARCHITECTURE.md §5) — so
      // splitting on ',' alone yields 'physical:3' for x and parses to NaN. Read the
      // coordinates from the end, which also tolerates a planeId containing ':' or ','.
      const comma = key.lastIndexOf(',');
      const colon = key.lastIndexOf(':', comma);
      result.push({
        x: parseInt(key.slice(colon + 1, comma), 10),
        y: parseInt(key.slice(comma + 1), 10),
        items,
      });
    }
    return result;
  }

  public getTrapAt(x: number, y: number): TrapInstance | null {
    return this.traps.get(this.posKey(x, y)) ?? null;
  }

  public addTrap(trap: TrapInstance): boolean {
    if (!this.inBounds(trap.x, trap.y)) return false;
    this.traps.set(this.posKey(trap.x, trap.y), trap);
    if (trap.revealed) {
      this.setTile(trap.x, trap.y, TILES.TRAP);
    }
    return true;
  }

  public removeTrapAt(x: number, y: number): TrapInstance | null {
    const key = this.posKey(x, y);
    const trap = this.traps.get(key);
    if (!trap) return null;
    this.traps.delete(key);
    return trap;
  }

  public getAllTraps(): TrapInstance[] {
    return Array.from(this.traps.values());
  }

  public static createBoxRoom(width: number, height: number): GameMap {
    const map = new GameMap(width, height, TILES.FLOOR);
    for (let x = 0; x < width; x++) {
      map.setTile(x, 0, TILES.WALL);
      map.setTile(x, height - 1, TILES.WALL);
    }
    for (let y = 0; y < height; y++) {
      map.setTile(0, y, TILES.WALL);
      map.setTile(width - 1, y, TILES.WALL);
    }
    return map;
  }
}
