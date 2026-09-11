import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import type { Position } from '../types';
import { NPC } from '../entities/npc';
import type { TownLayoutDefinition } from '../types/manifest';
import { Merchant } from '../economy/merchant';

export interface TownResult {
  map: GameMap;
  playerSpawn: Position;
  stairsDown: Position;
  npcs: NPC[];
  merchants: Map<string, Merchant>;
}

export class TownMapGenerator {
  public readonly width: number;
  public readonly height: number;
  public readonly layout?: TownLayoutDefinition;

  constructor(width = 50, height = 30, layout?: TownLayoutDefinition) {
    this.layout = layout;
    this.width = layout?.width ?? width;
    this.height = layout?.height ?? height;
  }

  public generate(): TownResult {
    const map = new GameMap(this.width, this.height, TILES.WALL);
    const npcs: NPC[] = [];
    const merchants = new Map<string, Merchant>();

    // 1. Carve town courtyard / streets
    for (let y = 1; y < this.height - 1; y++) {
      for (let x = 1; x < this.width - 1; x++) {
        map.setTile(x, y, TILES.FLOOR);
      }
    }

    // Helper to build a stone building with walls and an entrance door
    const buildBuilding = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      doorX: number,
      doorY: number,
      isOpen = false
    ) => {
      // Exterior walls
      for (let x = x1; x <= x2; x++) {
        map.setTile(x, y1, TILES.WALL);
        map.setTile(x, y2, TILES.WALL);
      }
      for (let y = y1; y <= y2; y++) {
        map.setTile(x1, y, TILES.WALL);
        map.setTile(x2, y, TILES.WALL);
      }
      // Entrance door
      map.setTile(doorX, doorY, isOpen ? TILES.DOOR_OPEN : TILES.DOOR_CLOSED);
    };

    if (this.layout) {
      for (const b of this.layout.buildings) {
        buildBuilding(b.bounds.x1, b.bounds.y1, b.bounds.x2, b.bounds.y2, b.door.x, b.door.y, b.door.isOpen);
      }

      for (const n of this.layout.npcs) {
        const npc = new NPC({
          id: n.id,
          name: n.name,
          role: n.role,
          shopId: n.shopId,
          position: { ...n.position },
          greeting: n.greeting,
          dialogText: n.dialogText ?? '',
        });
        npcs.push(npc);
        map.addEntity(npc);

        if (n.merchantConfig) {
          const merchant = new Merchant(
            n.merchantConfig.id,
            n.merchantConfig.name,
            n.merchantConfig.name,
            'general',
            n.merchantConfig.greeting,
            n.merchantConfig.initialInventory
          );
          merchants.set(merchant.id, merchant);
        }
      }

      map.setTile(this.layout.stairsDown.x, this.layout.stairsDown.y, TILES.STAIRS_DOWN);

      return {
        map,
        playerSpawn: { ...this.layout.playerSpawn },
        stairsDown: { ...this.layout.stairsDown },
        npcs,
        merchants,
      };
    }

    // Generic fallback if no layout is provided: central stairs down and clear courtyard
    const stairsDownPos: Position = { x: Math.floor(this.width / 2), y: Math.floor(this.height / 2) };
    map.setTile(stairsDownPos.x, stairsDownPos.y, TILES.STAIRS_DOWN);
    const playerSpawn: Position = { x: 5, y: 5 };

    return {
      map,
      playerSpawn,
      stairsDown: stairsDownPos,
      npcs,
      merchants,
    };
  }
}
