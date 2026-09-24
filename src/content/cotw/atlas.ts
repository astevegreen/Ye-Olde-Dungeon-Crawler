import type { AtlasProceduralTheme } from '../../engine';

const COTW_PALETTE: Record<string, string> = {
  stoneDark: '#1c2333',
  stoneFloor: '#0f172a',
  woodBrown: '#78350f',
  ironSlate: '#334155',
  goldYellow: '#f59e0b',
  crimsonRed: '#ef4444',
  heroBlue: '#2563eb',
  heroineGreen: '#047857',
  skinTone: '#fed7aa',

  // Player subtle blue shift / tint tokens
  heroBlueShift: '#3b82f6',
  heroCyan: '#38bdf8',
  playerTintRim: '#93c5fd',
  steelBlue: '#7dd3fc',

  // Rime Hollows (permafrost, ice, cold blue)
  rimeIce: '#38bdf8',
  rimeDark: '#0f172a',
  rimeFloor: '#0c1a2e',
  rimeWall: '#1e293b',
  rimeFrost: '#e0f2fe',
  rimeGlow: '#7dd3fc',

  // Abandoned Dwarven Works (brass, stone, rust, steam)
  dwarfBrass: '#d97706',
  dwarfStone: '#292524',
  dwarfRust: '#7c2d12',
  dwarfIron: '#44403c',
  dwarfGlow: '#f97316',
  steamMetal: '#78716c',

  // Obsidian Siphon (obsidian, magma, ash)
  obsidianBlack: '#0a0a0c',
  obsidianPurple: '#1e1b4b',
  magmaOrange: '#ea580c',
  magmaRed: '#dc2626',
  ashGray: '#3f3f46',
  lavaYellow: '#fef08a',

  // Tarnished Silver Veins (silver ore, spectral mist)
  silverVein: '#94a3b8',
  silverShine: '#e2e8f0',
  silverDark: '#181e29',
  silverOre: '#64748b',
  spectralCyan: '#67e8f9',
  phantomTeal: '#2dd4bf',

  // World Bark Descent (ancient bark, moss, roots)
  barkBrown: '#451a03',
  barkGreen: '#14532d',
  mossGreen: '#15803d',
  rootWood: '#78350f',
  leafGold: '#84cc16',
  grubPale: '#fef3c7',

  // Maw of Malice (abyssal purple, bone, malice)
  maliceVoid: '#090514',
  malicePurple: '#4c1d95',
  maliceCrimson: '#991b1b',
  boneWhite: '#f1f5f9',
  boneGray: '#cbd5e1',
  eyeAmber: '#fbbf24',

  // The Rotting Root (blight, toxic green, core)
  rootBlight: '#1a1c12',
  toxicGreen: '#4d7c0f',
  blightCore: '#365314',
  eldritchGlow: '#a3e635',

  // Town of Bjarnarhaven & Architecture
  townWood: '#78350f',
  townPlank: '#92400e',
  townSnow: '#e2e8f0',
  townTempleGold: '#eab308',
  townTempleStone: '#475569',
  hearthGlow: '#f97316',
  hearthAmber: '#fbbf24',
  townSmithyIron: '#334155',
  townShopTeal: '#0e7490',
  townBankSteel: '#1e293b',
};


import { COTW_TILE_ZONE_BANDS } from './tileZones';
import { COTW_TERRAIN_ART } from './terrain';

export const COTW_ATLAS_THEME: AtlasProceduralTheme = {
  themeId: 'cotw',
  palette: COTW_PALETTE,
  tileZoneBands: COTW_TILE_ZONE_BANDS,
  terrain: COTW_TERRAIN_ART,
};

