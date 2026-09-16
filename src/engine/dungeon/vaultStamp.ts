import type { Position } from '../types';
import type { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import type { TileDefinition } from '../types';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import type { ItemDefinition } from '../types/manifest';
import { createScaledMonster, selectDungeonMonsterDefinition } from './spawner';
import { createDungeonChest } from './lootSpawner';


import type { Predicate } from '../predicates/types';

export interface VaultBlueprint {
  id: string;
  name: string;
  description: string;
  minFloor: number;
  maxFloor?: number;
  layout: string[];
  preferredMonsters?: string[];
  predicate?: Predicate;
}

export interface StampedVaultResult {
  vault: VaultBlueprint;
  x: number;
  y: number;
  width: number;
  height: number;
  connectors: Position[];
  chestSpawns: Position[];
  monsterSpawns: Position[];
}

export class VaultStamper {
  /**
   * Translates an ASCII legend symbol into a TileDefinition, plus entity/item markers.
   */
  public static parseSymbol(char: string): {
    tile: TileDefinition;
    isConnector: boolean;
    isChest: boolean;
    isMonster: boolean;
  } {
    switch (char) {
      case '#':
        return { tile: TILES.WALL, isConnector: false, isChest: false, isMonster: false };
      case '.':
        return { tile: TILES.FLOOR, isConnector: false, isChest: false, isMonster: false };
      case '~':
        return { tile: TILES.SHALLOW_WATER, isConnector: false, isChest: false, isMonster: false };
      case 'X':
        return { tile: TILES.CHASM, isConnector: false, isChest: false, isMonster: false };
      case '+':
        return { tile: TILES.DOOR_CLOSED, isConnector: false, isChest: false, isMonster: false };
      case 'B':
        return { tile: TILES.IRON_BARS, isConnector: false, isChest: false, isMonster: false };
      case 'P':
        return { tile: TILES.PILLAR, isConnector: false, isChest: false, isMonster: false };
      case '@':
        // Connector doorway / passage into the corridor network
        return { tile: TILES.FLOOR, isConnector: true, isChest: false, isMonster: false };
      case 'C':
        return { tile: TILES.FLOOR, isConnector: false, isChest: true, isMonster: false };
      case 'M':
        return { tile: TILES.FLOOR, isConnector: false, isChest: false, isMonster: true };
      default:
        return { tile: TILES.FLOOR, isConnector: false, isChest: false, isMonster: false };
    }
  }

  /**
   * Stamps a vault blueprint onto the map at the designated (originX, originY).
   */
  public static stamp(
    map: GameMap,
    blueprint: VaultBlueprint,
    originX: number,
    originY: number,
    currentFloor: number,
    monsterCandidates: MonsterDefinition[] = [],
    itemCandidates: ItemDefinition[] = [],
    rng: () => number
  ): StampedVaultResult {
    const layout = blueprint.layout;
    const height = layout.length;
    const width = layout[0]?.length ?? 0;

    const connectors: Position[] = [];
    const chestSpawns: Position[] = [];
    const monsterSpawns: Position[] = [];

    for (let r = 0; r < height; r++) {
      const row = layout[r];
      for (let c = 0; c < width; c++) {
        const char = row[c] ?? '#';
        const worldX = originX + c;
        const worldY = originY + r;

        if (!map.inBounds(worldX, worldY)) continue;

        const parsed = this.parseSymbol(char);
        map.setTile(worldX, worldY, parsed.tile);

        if (parsed.isConnector) {
          connectors.push({ x: worldX, y: worldY });
        } else if (parsed.isChest) {
          chestSpawns.push({ x: worldX, y: worldY });
          const chestId = `vault-chest-${blueprint.id}-${worldX}-${worldY}-${Math.floor(rng() * 1000000)}`;
          const chest = createDungeonChest(chestId, currentFloor, itemCandidates, rng);
          map.addItemAt(worldX, worldY, chest);
        } else if (parsed.isMonster) {
          monsterSpawns.push({ x: worldX, y: worldY });
          // Select preferred monster or suitable scaled monster for this floor
          let def: MonsterDefinition | null = null;
          if (blueprint.preferredMonsters && blueprint.preferredMonsters.length > 0) {
            const chosenId = blueprint.preferredMonsters[Math.floor(rng() * blueprint.preferredMonsters.length)];
            def = monsterCandidates.find((m) => m.id === chosenId) ?? null;
          }
          if (!def) {
            def = selectDungeonMonsterDefinition(monsterCandidates, currentFloor, rng);
          }
          if (def) {
            const mId = `vault-mon-${blueprint.id}-${worldX}-${worldY}-${Math.floor(rng() * 1000)}`;
            const monster = createScaledMonster(def, mId, { x: worldX, y: worldY }, currentFloor);
            map.addEntity(monster);
          }
        }
      }
    }

    return {
      vault: blueprint,
      x: originX,
      y: originY,
      width,
      height,
      connectors,
      chestSpawns,
      monsterSpawns,
    };
  }
}
