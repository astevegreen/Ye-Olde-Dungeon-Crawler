import type {
  GameContentManifest,
  ItemDefinition,
  MonsterDefinition,
  SpellDefinition,
  SpriteRecipe,
  ThemeTokens,
  VaultBlueprint,
} from '../../../src/engine';
import { FIXTURE_ACTION_HOOKS, FIXTURE_AI_BEHAVIORS, FIXTURE_STATUS_HANDLERS } from './behavior';

/*
 * A second content pack for the tests that prove the engine and presentation stay
 * pack-neutral (ARCHITECTURE.md §3). It isn't a game: each entry is here because a test
 * exercises it. It lives outside src/content/, so check:engine-creep doesn't read its
 * identifiers as a shipping pack's, and nothing bundles it.
 */

const FIXTURE_MONSTERS: MonsterDefinition[] = [
  {
    id: 'raider',
    name: 'Raider',
    minFloor: 1,
    stats: { hp: 20, maxHp: 20, attack: 6, defense: 2 },
    speed: 100,
    aiType: 'melee',
    fleeHealthPercent: 0.15,
    xpValue: 30,
    lootTable: [],
  },
  {
    id: 'warlord',
    name: 'Warlord',
    minFloor: 5,
    stats: { hp: 120, maxHp: 120, attack: 18, defense: 7 },
    speed: 105,
    aiType: 'warlord',
    fleeHealthPercent: 0,
    xpValue: 500,
    lootTable: [],
  },
];

const FIXTURE_ITEMS: ItemDefinition[] = [
  {
    id: 'broadsword',
    name: 'Broadsword',
    category: 'weapon',
    slot: 'mainHand',
    weight: 10,
    bulk: 7,
    value: 60,
    stats: { attackBonus: 8 },
    description: 'A plain steel sword.',
  },
  {
    id: 'health_potion',
    name: 'Healing Draught',
    category: 'potion',
    weight: 1,
    bulk: 1,
    value: 20,
    itemType: 'potion',
    potionConfig: { potionType: 'health', potency: 30, effects: [{ type: 'restore_hp', amount: 30 }] },
    description: 'Restores 30 HP.',
  },
  {
    id: 'war_banner',
    name: 'War Banner',
    category: 'misc',
    weight: 5,
    bulk: 8,
    value: 1000,
    identified: true,
    description: "The warlord's banner: the quest relic.",
  },
];

/** A chaining ray and a self-buff: the visual archetypes the shipping pack doesn't use. */
export const FIXTURE_SPELLS: SpellDefinition[] = [
  {
    id: 'chain_lightning',
    name: 'Chain Lightning',
    school: 'Combat',
    manaCost: 14,
    element: 'lightning',
    range: 8,
    basePower: 22,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description: 'Lightning that leaps between enemies.',
    visual: { archetype: 'chain', color: '#38bdf8', stepDelayMs: 15, durationMs: 160 },
    effects: [
      { type: 'damage', amount: '3d6+6', element: 'lightning' },
      { type: 'chain', maxHops: 3, hopRange: 4, damageDecay: 0.25 },
    ],
  },
  {
    id: 'healing_light',
    name: 'Healing Light',
    school: 'HealingDivination',
    manaCost: 8,
    element: 'healing',
    range: 0,
    basePower: 35,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'self',
    targetingMode: 'self',
    description: 'Restores 35 HP.',
    visual: { archetype: 'self_buff', color: '#fef08a', durationMs: 240 },
    effects: [{ type: 'heal', amount: 35 }],
  },
];

/** Every token set, and none equal to the defaults, so a test sees the pack's theme take hold. */
export const FIXTURE_THEME_TOKENS: ThemeTokens = {
  bg: '#0c0a09',
  panel: '#292524',
  borderLight: '#78716c',
  borderDark: '#1c1917',
  text: '#f5f5f4',
  titlebarStart: '#7f1d1d',
  titlebarEnd: '#b91c1c',
  titlebarText: '#fef08a',
  accent: '#f59e0b',
  fontFamily: '"Georgia", "Times New Roman", serif',
  borderStyle: 'flat',
  canvasBg: '#0c0a09',
  hudBg: '#1c1917',
  hudBorder: '#44403c',
  hudText: '#f5f5f4',
  hudAccent: '#f59e0b',
  modalBg: '#292524',
  modalBorder: '#d97706',
  modalTitlebar: '#7f1d1d',
  modalTitlebarText: '#fef08a',
  modalBackdrop: 'rgba(12, 10, 9, 0.88)',
  cardBg: '#1c1917',
  cardBorder: '#57534e',
  textMuted: '#a8a29e',
  healthBar: '#dc2626',
  manaBar: '#2563eb',
};

/** The relic's own art, keyed by its definition ID. */
export const FIXTURE_SPRITE_RECIPES: Record<string, SpriteRecipe> = {
  war_banner: (ctx, ox, oy) => {
    ctx.fillStyle = '#78350f';
    ctx.fillRect(ox + 15, oy + 3, 3, 26);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(ox + 6, oy + 6, 12, 14);
  },
};

/** One vault per glyph mix: barricades and doors, pillars, chasms. */
export const FIXTURE_VAULTS: VaultBlueprint[] = [
  {
    id: 'armory',
    name: 'Armory',
    description: 'A barricaded store room.',
    minFloor: 2,
    layout: [
      '###########',
      '#BBB###BBB#',
      '#B.......B#',
      '#B..M.C..B#',
      '#B.......B#',
      '###++#++###',
      '#.........#',
      '@....M....@',
      '###########',
    ],
    preferredMonsters: ['raider'],
  },
  {
    id: 'ritual_sanctum',
    name: 'Ritual Sanctum',
    description: 'A pillared ritual chamber.',
    minFloor: 3,
    layout: [
      '#############',
      '#...P.P.P...#',
      '@...P.P.P...@',
      '#.....C.....#',
      '#...M...M...#',
      '#.....C.....#',
      '@...P.P.P...@',
      '#...P.P.P...#',
      '#############',
    ],
    preferredMonsters: ['raider'],
  },
  {
    id: 'chasm_redoubt',
    name: 'Chasm Redoubt',
    description: 'A redoubt ringed by chasms.',
    minFloor: 4,
    layout: [
      '###############',
      '#XXXXX...XXXXX#',
      '#X###BB+BB###X#',
      '@...#..C..#...@',
      '#X#.#.M.M.#.#X#',
      '@...#..C..#...@',
      '#X###BB+BB###X#',
      '#XXXXX...XXXXX#',
      '###############',
    ],
    preferredMonsters: ['raider'],
  },
];

const raiders = { monsterIds: ['raider'], maxMonsters: 6 };

export const fixtureManifest: GameContentManifest = {
  id: 'fixture',
  name: 'Fixture Pack',
  description: 'A test pack.',
  branding: {
    hallOfFameName: 'Hall of Heroes',
    hallOfFameShortName: 'Heroes',
    worldName: 'Testland',
  },
  monsters: FIXTURE_MONSTERS,
  items: FIXTURE_ITEMS,
  spells: FIXTURE_SPELLS,
  town: {
    name: 'Fixture Keep',
    width: 30,
    height: 20,
    playerSpawn: { x: 10, y: 14 },
    stairsDown: { x: 15, y: 5 },
    buildings: [],
    npcs: [
      {
        id: 'npc-captain',
        name: 'Captain Ardent',
        role: 'villager',
        position: { x: 15, y: 10 },
        greeting: 'The warlord holds the fifth floor.',
        isStationary: true,
      },
    ],
  },
  quest: {
    id: 'fixture_quest',
    name: "The Warlord's Hold",
    maxFloor: 5,
    bossMonsterId: 'warlord',
    relicItemId: 'war_banner',
    victoryNpcId: 'npc-captain',
    victoryFloor: 0,
    bossFloorLayout: {
      width: 45,
      height: 35,
      playerSpawn: { x: 22, y: 28 },
      stairsUp: { x: 22, y: 30 },
      bossSpawn: { x: 22, y: 7 },
      pillars: [],
      guards: [],
    },
    floorEncounters: { 1: raiders, 2: raiders, 3: raiders, 4: raiders },
  },
  atlas: { themeId: 'fixture' },
  starterKit: { weaponItemId: 'broadsword', packItemIds: ['health_potion'], spellsKnown: ['healing_light'] },
  theme: FIXTURE_THEME_TOKENS,
  spriteRecipes: FIXTURE_SPRITE_RECIPES,
  presetNames: ['Ash', 'Wren'],
  statusHandlers: FIXTURE_STATUS_HANDLERS,
  actionHooks: FIXTURE_ACTION_HOOKS,
  aiBehaviors: FIXTURE_AI_BEHAVIORS,
  combatConfig: { minDamage: 1, critChance: 0.15, critMultiplier: 2.0, damageVariance: 0.05 },
  progressionConfig: {
    baseXp: 120,
    xpExponent: 1.25,
    statGains: { maxHp: 8, maxMana: 6, strength: 2, intelligence: 2, constitution: 2, dexterity: 1, baseAttack: 2, baseDefense: 1 },
  },
  vaults: FIXTURE_VAULTS,
};

export { FIXTURE_ACTION_HOOKS, FIXTURE_AI_BEHAVIORS };
