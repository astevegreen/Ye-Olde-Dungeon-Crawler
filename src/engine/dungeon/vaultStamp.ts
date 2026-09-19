import type { Position, GameDifficulty } from '../types';
import type { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import type { TileDefinition } from '../types';
import { getMonsterDefinition, type MonsterDefinition } from '../bestiary/monsterDefinitions';
import type { ItemDefinition } from '../types/manifest';
import type { MonsterScalingConfig } from '../types/monsterScaling';
import { createScaledMonster, selectDungeonMonsterDefinition } from './spawner';
import { createDungeonChest } from './lootSpawner';
import type { EngineRegistries } from '../registries';


import type { Predicate } from '../predicates/types';

export interface VaultBlueprint {
  id: string;
  name: string;
  description: string;
  minFloor: number;
  maxFloor?: number;
  layout: string[];
  preferredMonsters?: string[];
  minibossId?: string;
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
    isMiniboss: boolean;
  } {
    switch (char) {
      case '#':
        return { tile: TILES.WALL, isConnector: false, isChest: false, isMonster: false, isMiniboss: false };
      case '.':
        return { tile: TILES.FLOOR, isConnector: false, isChest: false, isMonster: false, isMiniboss: false };
      case '~':
        return { tile: TILES.SHALLOW_WATER, isConnector: false, isChest: false, isMonster: false, isMiniboss: false };
      case 'X':
        return { tile: TILES.CHASM, isConnector: false, isChest: false, isMonster: false, isMiniboss: false };
      case '+':
        return { tile: TILES.DOOR_CLOSED, isConnector: false, isChest: false, isMonster: false, isMiniboss: false };
      case 'B':
        return { tile: TILES.IRON_BARS, isConnector: false, isChest: false, isMonster: false, isMiniboss: false };
      case 'P':
        return { tile: TILES.PILLAR, isConnector: false, isChest: false, isMonster: false, isMiniboss: false };
      case '@':
        // Connector doorway / passage into the corridor network
        return { tile: TILES.FLOOR, isConnector: true, isChest: false, isMonster: false, isMiniboss: false };
      case 'C':
        return { tile: TILES.FLOOR, isConnector: false, isChest: true, isMonster: false, isMiniboss: false };
      case 'M':
        return { tile: TILES.FLOOR, isConnector: false, isChest: false, isMonster: true, isMiniboss: false };
      case 'K':
        return { tile: TILES.FLOOR, isConnector: false, isChest: false, isMonster: true, isMiniboss: true };
      default:
        return { tile: TILES.FLOOR, isConnector: false, isChest: false, isMonster: false, isMiniboss: false };
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
    rng: () => number,
    scalingConfig?: MonsterScalingConfig,
    difficulty?: GameDifficulty,
    registries?: EngineRegistries
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
        }

        if (parsed.isChest) {
          chestSpawns.push({ x: worldX, y: worldY });
          const chestId = `vault-chest-${blueprint.id}-${worldX}-${worldY}-${Math.floor(rng() * 1000000)}`;
          const chest = createDungeonChest(chestId, currentFloor, itemCandidates, rng);
          map.addItemAt(worldX, worldY, chest);
        }

        if (parsed.isMonster || parsed.isMiniboss) {
          monsterSpawns.push({ x: worldX, y: worldY });
          let def: MonsterDefinition | null | undefined;
          if (parsed.isMiniboss && blueprint.minibossId) {
            def =
              monsterCandidates.find((m) => m.id === blueprint.minibossId) ??
              (registries ? registries.monsters.get(blueprint.minibossId) : getMonsterDefinition(blueprint.minibossId));
          } else if (blueprint.preferredMonsters && blueprint.preferredMonsters.length > 0) {
            const prefId = blueprint.preferredMonsters[Math.floor(rng() * blueprint.preferredMonsters.length)];
            def =
              monsterCandidates.find((m) => m.id === prefId) ??
              (registries ? registries.monsters.get(prefId) : getMonsterDefinition(prefId));
          }
          if (!def) {
            def = selectDungeonMonsterDefinition(monsterCandidates, currentFloor, rng);
          }
          if (def) {
            const mId = parsed.isMiniboss
              ? `vault-miniboss-${blueprint.id}-${worldX}-${worldY}`
              : `vault-mon-${blueprint.id}-${worldX}-${worldY}-${Math.floor(rng() * 1000)}`;
            const monster = createScaledMonster(
              def,
              mId,
              { x: worldX, y: worldY },
              currentFloor,
              undefined,
              undefined,
              scalingConfig,
              difficulty,
              registries
            );
            if (parsed.isMiniboss) {
              monster.aiState = 'hunting';
            }
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
