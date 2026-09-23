import type { GameEngine } from '../engine';
import { Visibility } from '../fov/types';
import { Monster } from '../entities/monster';
import type { TileInspection, InspectedTerrain, InspectedTrap, InspectedEntity, InspectedItem } from './types';

export class TileInspector {
  public static inspectTile(engine: GameEngine, x: number, y: number): TileInspection {
    if (!engine.map.inBounds(x, y)) {
      return {
        x,
        y,
        visibility: 'unexplored',
        terrain: null,
        traps: [],
        entity: null,
        items: [],
      };
    }

    const fovVis = engine.fov.getVisibility(x, y);
    const visibility: 'visible' | 'explored' | 'unexplored' =
      fovVis === Visibility.Visible
        ? 'visible'
        : fovVis === Visibility.Explored
        ? 'explored'
        : 'unexplored';

    if (visibility === 'unexplored') {
      return {
        x,
        y,
        visibility: 'unexplored',
        terrain: null,
        traps: [],
        entity: null,
        items: [],
      };
    }

    // 1. Terrain data
    const tile = engine.map.getTile(x, y);
    let terrain: InspectedTerrain | null = null;
    if (tile) {
      terrain = {
        name: tile.name,
        type: tile.type,
        passable: tile.passable,
        transparent: tile.transparent,
        description: tile.description,
      };
    }

    // 2. Traps data (only shown if revealed)
    const traps: InspectedTrap[] = [];
    const trapInstance = engine.map.getTrapAt(x, y);
    if (trapInstance && trapInstance.revealed) {
      const formattedName = trapInstance.type
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      traps.push({
        id: trapInstance.id,
        name: `${formattedName} Trap [Revealed]`,
        type: trapInstance.type,
        revealed: true,
      });
    }

    // 3. Entity data (only shown if tile is actively visible in FOV)
    let entity: InspectedEntity | null = null;
    if (visibility === 'visible') {
      const ent = engine.map.getEntityAt(x, y);
      if (ent && ent.isAlive()) {
        const speedTier: 'Slow' | 'Normal' | 'Fast' =
          ent.speed > 100 ? 'Fast' : ent.speed < 100 ? 'Slow' : 'Normal';

        const activeEffects =
          ent.statusManager && typeof ent.statusManager.getAll === 'function'
            ? ent.statusManager.getAll()
            : [];
        const statusEffects = activeEffects.map((s) => `${s.type} (${s.duration}t)`);

        entity = {
          name: ent.name,
          type: ent.type as 'player' | 'monster' | 'npc',
          hp: ent.hp,
          maxHp: ent.maxHp,
          speed: ent.speed,
          speedTier,
          statusEffects,
          intent: ent instanceof Monster ? ent.intent : undefined,
        };
      }
    }

    // 4. Ground items (visible if explored or visible)
    const groundItemsList = engine.map.getItemsAt(x, y);
    const items: InspectedItem[] = groundItemsList.map((i) => ({
      id: i.id,
      name: i.displayName || i.name || i.unidentifiedName || 'Item',
      category: i.category,
      weight: typeof i.totalWeight === 'function' ? i.totalWeight() : (i.weight ?? 0),
      bulk: typeof i.totalBulk === 'function' ? i.totalBulk() : (i.bulk ?? 0),
      stats: i.stats,
      enchantmentLevel: i.enchantmentLevel,
      elementalAffix: i.elementalAffix,
    }));

    return {
      x,
      y,
      visibility,
      terrain,
      traps,
      entity,
      items,
    };
  }
}
