import type { Position, GameDifficulty } from '../types';
import type { GameMap } from '../grid/map';
import { TILES, getTileDefinition, hasTileDefinition } from '../grid/tile';
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
  /**
   * Extra layout symbols mapped to tile types (resolved through the tile registry, so
   * a pack's own `customTiles` work). Checked before the built-in symbols, letting a
   * pack stamp its own interactive tiles without the engine knowing their names.
   */
  legend?: Record<string, string>;
  /**
   * Excluded from the random vault pass: stamped only when a manifest names it as a
   * floor's forced vault (`scriptedVaultPlacements`, `runeOfReturn.acquisition`).
   */
  scriptedOnly?: boolean;
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
  /** Ground positions of `N` markers, filled with the placement's declared NPCs. */
  npcSpawns: Position[];
}

interface ParsedVaultSymbol {
  tile: TileDefinition;
  isConnector?: boolean;
  isChest?: boolean;
  isMonster?: boolean;
  isMiniboss?: boolean;
  isNpcSpawn?: boolean;
}

export class VaultStamper {
  /**
   * Translates an ASCII layout symbol into a TileDefinition, plus entity/item markers.
   * A blueprint `legend` entry wins over the built-in symbols below.
   */
  public static parseSymbol(char: string, legend?: Record<string, string>): ParsedVaultSymbol {
    const legendType = legend?.[char];
    if (legendType !== undefined && hasTileDefinition(legendType)) {
      return { tile: getTileDefinition(legendType) };
    }
    switch (char) {
      case '#':
        return { tile: TILES.WALL };
      case '~':
        return { tile: TILES.SHALLOW_WATER };
      case 'X':
        return { tile: TILES.CHASM };
      case '+':
        return { tile: TILES.DOOR_CLOSED };
      case 'B':
        return { tile: TILES.IRON_BARS };
      case 'P':
        return { tile: TILES.PILLAR };
      case '@':
        // Connector doorway / passage into the corridor network
        return { tile: TILES.FLOOR, isConnector: true };
      case 'C':
        return { tile: TILES.FLOOR, isChest: true };
      case 'M':
        return { tile: TILES.FLOOR, isMonster: true };
      case 'K':
        return { tile: TILES.FLOOR, isMonster: true, isMiniboss: true };
      case 'N':
        return { tile: TILES.FLOOR, isNpcSpawn: true };
      default:
        return { tile: TILES.FLOOR };
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
    const npcSpawns: Position[] = [];

    for (let r = 0; r < height; r++) {
      const row = layout[r];
      for (let c = 0; c < width; c++) {
        const char = row[c] ?? '#';
        const worldX = originX + c;
        const worldY = originY + r;

        if (!map.inBounds(worldX, worldY)) continue;

        const parsed = this.parseSymbol(char, blueprint.legend);
        map.setTile(worldX, worldY, parsed.tile);

        if (parsed.isNpcSpawn) {
          npcSpawns.push({ x: worldX, y: worldY });
        }

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
      npcSpawns,
    };
  }
}
