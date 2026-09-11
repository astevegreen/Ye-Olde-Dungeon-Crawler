import type { AtlasProceduralTheme } from '../../engine/types/manifest';

export const COTW_PALETTE: Record<string, string> = {
  stoneDark: '#1c2333',
  stoneFloor: '#0f172a',
  woodBrown: '#78350f',
  ironSlate: '#334155',
  goldYellow: '#f59e0b',
  crimsonRed: '#ef4444',
  heroBlue: '#2563eb',
  heroineGreen: '#047857',
  skinTone: '#fed7aa',
};

export const COTW_ATLAS_THEME: AtlasProceduralTheme = {
  themeId: 'cotw',
  palette: COTW_PALETTE,
};
