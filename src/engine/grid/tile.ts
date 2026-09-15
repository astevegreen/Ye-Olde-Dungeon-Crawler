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
  RUNIC_CONDUIT: {
    type: 'runic_conduit',
    name: 'Dormant Leyline Circle',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: 'Ω',
    description: 'An ancient extraction conduit humming with dormant radiant power. Stand upon it to initiate the extraction ritual.',
    interactionHandlerId: 'runic_conduit',
  },
  CONDUIT_NODE: {
    type: 'conduit_node',
    name: 'Charged Leyline Node',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '☼',
    description: 'Crackling with raw magical voltage! Step onto this node to channel a charge into the conduit.',
    interactionHandlerId: 'conduit_node',
  },
  VALKYRIE_SPRINT: {
    type: 'valkyrie_sprint',
    name: 'Gjallarhorn Shrine',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: 'Ψ',
    description: 'An ancient ivory horn mounted on a runic pedestal. Sounding it opens the Valkyrie’s Sprint escape gauntlet.',
    interactionHandlerId: 'valkyrie_sprint',
  },
  DWARVEN_WINCH: {
    type: 'dwarven_winch',
    name: 'Dwarven Counterweight Winch',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '⚙',
    description: 'A massive mechanical hoist shaft connecting to the surface. Requires balanced counterweight ballast to operate safely.',
    interactionHandlerId: 'dwarven_winch',
  },
  GATEWAY_VALHALLA: {
    type: 'gateway_valhalla',
    name: 'Gateway to Valhalla',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '▲',
    description: 'A divine golden vortex radiating celestial light. Step through to claim eternal victory!',
    interactionHandlerId: 'gateway_valhalla',
  },
  TOWN_PORTAL: {
    type: 'town_portal',
    name: 'Runic Descent Portal',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '🌀',
    description: 'A shimmering dimensional gateway leading directly back into the depths where you departed.',
    interactionHandlerId: 'town_portal',
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
  },
};

const tileRegistry = new Map<string, TileDefinition>();

// Initialize registry with all canonical definitions
for (const tile of Object.values(TILES)) {
  tileRegistry.set(tile.type, tile);
}

/**
 * Retrieves a TileDefinition from the data-driven tile registry.
 * Falls back to TILES.FLOOR for unknown tile types.
 */
export function getTileDefinition(type: string): TileDefinition {
  return tileRegistry.get(type) ?? TILES.FLOOR;
}

export function hasTileDefinition(type: string): boolean {
  return tileRegistry.has(type);
}

/**
 * Registers or overrides a TileDefinition in the registry.
 */
export function registerTileDefinition(definition: TileDefinition): void {
  tileRegistry.set(definition.type, definition);
}


