import type { TileDefinition } from '../types';

export const TILES: Record<string, TileDefinition> = {
  FLOOR: {
    type: 'floor',
    name: 'Stone Dungeon Floor',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '.',
    description: 'Smooth cold flagstone floor.',
  },
  WALL: {
    type: 'wall',
    name: 'Carved Stone Wall',
    passable: false,
    walkable: false,
    transparent: false,
    blocksProjectiles: true,
    glyph: '#',
    description: 'Impenetrable ancient stone masonry.',
  },
  DOOR_CLOSED: {
    type: 'door_closed',
    name: 'Closed Oak Door',
    passable: false,
    walkable: false,
    transparent: false,
    blocksProjectiles: true,
    glyph: '+',
    description: 'A heavy timber door, currently latched shut.',
    isDoor: true,
    isClosedDoor: true,
    isOpenDoor: false,
  },
  DOOR_OPEN: {
    type: 'door_open',
    name: 'Open Oak Door',
    passable: true,
    walkable: true,
    transparent: true,
    blocksProjectiles: false,
    glyph: '/',
    description: 'An open timber doorway.',
    isDoor: true,
    isOpenDoor: true,
    isClosedDoor: false,
  },
  STAIRS_DOWN: {
    type: 'stairs_down',
    name: 'Stone Stairs Descending',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '>',
    description: 'Worn stone steps descending deeper into the dungeon.',
    isStairs: true,
    isStairsDown: true,
    interactionHandlerId: 'stairs_down',
  },
  STAIRS_UP: {
    type: 'stairs_up',
    name: 'Stone Stairs Ascending',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '<',
    description: 'Stone steps leading upwards toward the surface.',
    isStairs: true,
    isStairsUp: true,
    interactionHandlerId: 'stairs_up',
  },
  SECRET_DOOR: {
    type: 'secret_door',
    name: 'Granite Wall',
    passable: false,
    walkable: false,
    transparent: false,
    blocksProjectiles: true,
    glyph: '#',
    description: 'Impenetrable ancient stone masonry.',
    isDoor: true,
    isSecret: true,
  },
  TRAP: {
    type: 'trap',
    name: 'Trap',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '^',
    description: 'Triggered Floor Mechanism.',
  },
  GATEWAY_VALHALLA: {
    type: 'gateway_valhalla',
    name: 'Gateway to Valhalla',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '▲',
    description: 'A divine golden vortex radiating celestial light. Step through to claim eternal victory!',
    interactionHandlerId: 'quest_victory_portal',
    visual: 'portal',
    landmarkLabel: 'Valhalla Gateway ✨',
  },
  SHALLOW_WATER: {
    type: 'shallow_water',
    name: 'Shallow Water',
    passable: true,
    walkable: true,
    transparent: true,
    blocksProjectiles: false,
    glyph: '~',
    description: 'Knee-deep chilly water (+50 move energy cost). Imparts 50% Fire resistance but 200% Lightning vulnerability!',
  },
  CHASM: {
    type: 'chasm',
    name: 'Chasm',
    passable: false,
    walkable: false,
    transparent: true,
    blocksProjectiles: false,
    glyph: 'X',
    description: 'A dizzying, pitch-black drop into the subterranean abyss. Blocks walking but permits arrows and spells. Beware knockback!',
  },
  IRON_BARS: {
    type: 'iron_bars',
    name: 'Iron Bars',
    passable: false,
    walkable: false,
    transparent: true,
    blocksProjectiles: false,
    glyph: 'B',
    description: 'Stout vertical iron bars anchored into stone. Blocks movement but permits line-of-sight and missile fire.',
  },
  PILLAR: {
    type: 'pillar',
    name: 'Stone Pillar',
    passable: false,
    walkable: false,
    transparent: false,
    blocksProjectiles: true,
    glyph: 'P',
    description: 'A massive carved column supporting the vaulted stone ceiling. Provides hard cover against ranged spells and arrows.',
  },
  ALTAR_TYR: {
    type: 'altar_tyr',
    name: 'Ancient Altar of Tyr',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '⛩',
    description: 'A weathered runic altar consecrated to Tyr, god of justice. Blood-stained defilement clings to the ancient runes.',
    interactionHandlerId: 'altar_tyr',
    landmarkLabel: 'Altar of Tyr ⚖️',
  },
};

import {
  type TileRegistryStore,
  activeTileStore,
  processDefaultTileStore,
} from '../registries/tileRegistryStore';

export function registerBuiltinTiles(store: TileRegistryStore): void {
  for (const tile of Object.values(TILES)) {
    store.register(tile);
  }
}

// Initialize default store with all canonical definitions
registerBuiltinTiles(processDefaultTileStore());

/**
 * Retrieves a TileDefinition from the data-driven tile registry.
 * Falls back to TILES.FLOOR for unknown tile types.
 */
export function getTileDefinition(type: string): TileDefinition {
  return activeTileStore().get(type) ?? TILES.FLOOR;
}

export function hasTileDefinition(type: string): boolean {
  return activeTileStore().has(type);
}

/**
 * Registers or overrides a TileDefinition in the registry.
 */
export function registerTileDefinition(definition: TileDefinition): void {
  activeTileStore().register(definition);
}

/**
 * Process-wide facade over whichever tile store is active (ARCHITECTURE.md §3, P-22).
 */
export class TileRegistry {
  public static register(definition: TileDefinition): void {
    activeTileStore().register(definition);
  }

  public static registerAll(
    definitions: readonly TileDefinition[] | TileDefinition[] | Record<string, TileDefinition> | Map<string, TileDefinition>
  ): void {
    activeTileStore().registerAll(definitions);
  }

  public static get(type: string): TileDefinition | undefined {
    return activeTileStore().get(type);
  }

  public static getDefinition(type: string): TileDefinition {
    return getTileDefinition(type);
  }

  public static has(type: string): boolean {
    return activeTileStore().has(type);
  }

  public static getAll(): readonly TileDefinition[] {
    return activeTileStore().getAll();
  }

  public static clear(): void {
    activeTileStore().clear();
  }

  public static resetToDefaults(): void {
    activeTileStore().clear();
    registerBuiltinTiles(activeTileStore());
  }
}


