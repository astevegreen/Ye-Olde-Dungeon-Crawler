import type { TileDefinition } from '../../engine';

/**
 * Castle of the Winds campaign-specific tile definitions (ARCHITECTURE.md §3, P-03 stage 3).
 * Extracted from engine built-in TILES so the core engine remains completely pack-neutral.
 */
export const COTW_TILES: TileDefinition[] = [
  {
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
  {
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
  {
    // Stamped by the floor-22 siphon vault's layout legend (hostageRitual.ts).
    type: 'siphon_altar',
    name: 'Siphon Altar of Járnviðr',
    passable: true,
    walkable: true,
    transparent: true,
    glyph: '_',
    description: 'An ancient obsidian altar marked with blood runes, its grooves pooled with dark vitriol.',
    interactionHandlerId: 'blood_altar_ritual',
    landmarkLabel: 'Siphon Altar 🩸',
  },
];
