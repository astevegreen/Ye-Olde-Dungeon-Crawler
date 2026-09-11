import type { GameContentManifest } from '../../engine/types/manifest';
import { WARCRAFT_MONSTERS } from './monsters';
import { WARCRAFT_ITEMS } from './items';
import { WARCRAFT_SPELLS } from './spells';
import { WARCRAFT_TOWN } from './town';
import { WARCRAFT_QUEST } from './quest';
import { WARCRAFT_STARTER_KIT } from './character';
import { WARCRAFT_AFFINITY_MATRIX } from './elements';
import { WARCRAFT_THEME_TOKENS } from './theme';
import { WARCRAFT_SPRITE_RECIPES } from './sprites';
import { WARCRAFT_STATUS_HANDLERS } from './status';
import { WARCRAFT_ACTION_HOOKS } from './hooks';
import { WARCRAFT_AI_BEHAVIORS } from './ai';
import { WARCRAFT_FEATURE_FLAGS, WARCRAFT_COMBAT_CONFIG, WARCRAFT_PROGRESSION_CONFIG } from './config';
import { WARCRAFT_VAULTS } from './vaults';

export const warcraftManifest: GameContentManifest = {
  id: 'warcraft',
  name: 'Warcraft: Orcs & Humans',
  description: 'Classic dark fantasy warfare across the shattered lands of Azeroth.',
  monsters: WARCRAFT_MONSTERS,
  items: WARCRAFT_ITEMS,
  spells: WARCRAFT_SPELLS,
  town: WARCRAFT_TOWN,
  quest: WARCRAFT_QUEST,
  atlas: { themeId: 'warcraft' },
  starterKit: WARCRAFT_STARTER_KIT,
  affinityMatrix: WARCRAFT_AFFINITY_MATRIX,
  theme: WARCRAFT_THEME_TOKENS,
  spriteRecipes: WARCRAFT_SPRITE_RECIPES,
  presetNames: ['Lothar', 'Garona', 'Khadgar', 'Medivh'],
  statusHandlers: WARCRAFT_STATUS_HANDLERS,
  actionHooks: WARCRAFT_ACTION_HOOKS,
  aiBehaviors: WARCRAFT_AI_BEHAVIORS,
  featureFlags: WARCRAFT_FEATURE_FLAGS,
  combatConfig: WARCRAFT_COMBAT_CONFIG,
  progressionConfig: WARCRAFT_PROGRESSION_CONFIG,
  initialWorldState: { flags: {}, counters: {}, factions: {} },
  vaults: WARCRAFT_VAULTS,
  choices: {},
  pacts: [],
};

export const WARCRAFT_MANIFEST = warcraftManifest;

export {
  WARCRAFT_MONSTERS,
  WARCRAFT_ITEMS,
  WARCRAFT_SPELLS,
  WARCRAFT_TOWN,
  WARCRAFT_QUEST,
  WARCRAFT_STARTER_KIT,
  WARCRAFT_AFFINITY_MATRIX,
  WARCRAFT_THEME_TOKENS,
  WARCRAFT_SPRITE_RECIPES,
  WARCRAFT_STATUS_HANDLERS,
  WARCRAFT_ACTION_HOOKS,
  WARCRAFT_AI_BEHAVIORS,
  WARCRAFT_FEATURE_FLAGS,
  WARCRAFT_COMBAT_CONFIG,
  WARCRAFT_PROGRESSION_CONFIG,
  WARCRAFT_VAULTS,
};
