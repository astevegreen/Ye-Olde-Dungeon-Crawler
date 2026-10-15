import type {
  GameContentManifest,
  GrimoireSystemConfig,
  NeighbourLendingConfig,
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
    // A boss resists being pacified or cursed to rise (P-31).
    statusImmunities: ['pacified', 'rises_when_slain'],
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
    spellType: 'damage',
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
    spellType: 'heal',
    visual: { archetype: 'self_buff', color: '#fef08a', durationMs: 240 },
    effects: [{ type: 'heal', amount: 35 }],
  },
  ...movementAndMarkSpells(),
  // The spell building blocks (P-28): several elements and pierce, a blood price, cleanse, hand-over.
  {
    id: 'forge_bolt',
    name: 'Forge Bolt',
    school: 'Combat',
    manaCost: 6,
    element: 'fire',
    range: 6,
    basePower: 20,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description: 'Fire and cold at once: it lands as whichever the target resists least, through resistance.',
    spellType: 'damage',
    effects: [{ type: 'damage', amount: 20, element: 'fire', elements: ['cold'], pierce: true }],
  },
  {
    id: 'blood_bolt',
    name: 'Blood Bolt',
    school: 'Combat',
    manaCost: 0,
    hpCost: 5,
    element: 'physical',
    range: 6,
    basePower: 12,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description: 'Paid in blood.',
    spellType: 'damage',
    lends: ['blood-price'],
    effects: [{ type: 'damage', amount: 12, element: 'physical' }],
  },
  {
    id: 'cleansing_word',
    name: 'Cleansing Word',
    school: 'HealingDivination',
    manaCost: 5,
    element: 'healing',
    range: 0,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'self',
    targetingMode: 'self',
    description: 'Lifts every affliction.',
    effects: [{ type: 'cleanse', all: true }],
  },
  {
    id: 'pass_the_burden',
    name: 'Pass the Burden',
    school: 'Enchantment',
    manaCost: 5,
    element: 'arcane',
    range: 6,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description: "Hands the caster's afflictions to the target.",
    spellType: 'control',
    effects: [{ type: 'handOver' }],
  },
];

/** The spell building blocks that move creatures and mark them (P-28), one spell each. */
function movementAndMarkSpells(): SpellDefinition[] {
  const spell = (id: string, name: string, targetingMode: 'target_entity' | 'tile', effects: SpellDefinition['effects']): SpellDefinition => ({
    id,
    name,
    school: 'Movement',
    manaCost: 5,
    element: 'arcane',
    range: 8,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: targetingMode === 'tile' ? 'tile' : 'ray',
    targetingMode,
    description: name,
    effects,
  });
  return [
    spell('shove', 'Shove', 'target_entity', [{ type: 'push', distance: 3 }]),
    spell('grasp', 'Grasp', 'target_entity', [{ type: 'pull', distance: 6 }]),
    spell('switch', 'Switch', 'target_entity', [{ type: 'swap' }]),
    spell('steered_blink', 'Steered Blink', 'tile', [{ type: 'teleport', range: 5, random: false, aimed: true }]),
    spell('brand', 'Brand', 'target_entity', [{ type: 'applyStatus', statusId: 'marked', duration: 10 }]),
    // Laying ground and gas on a 3×3 burst (P-32); `murk` is the pack's own gas.
    { ...spell('rime_patch', 'Rime Patch', 'tile', [{ type: 'lay', layer: 'surface', kind: 'ice_sheet', duration: 15 }]), areaOfEffect: 1 },
    { ...spell('murk_cloud', 'Murk Cloud', 'tile', [{ type: 'lay', layer: 'gas', kind: 'murk', duration: 10 }]), areaOfEffect: 1 },
  ];
}

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

/**
 * What touching slots lend (P-30), after the magic plan's neighbour rules: one flavour per
 * element, arcane by school, Blood-price, and a doubled form for each.
 */
export const FIXTURE_LENDING: NeighbourLendingConfig = {
  lendBySchool: ['arcane'],
  oppositeBonus: 0.25,
  flavours: [
    {
      id: 'fire',
      name: 'Burning',
      effects: [{ type: 'applyStatus', statusId: 'burning', duration: 2, potency: 2 }],
      doubled: { name: 'Blue fire', color: '#60a5fa', effects: [{ type: 'applyStatus', statusId: 'burning', duration: 4, potency: 4 }] },
    },
    {
      id: 'cold',
      name: 'Chill',
      effects: [{ type: 'applyStatus', statusId: 'slow', duration: 2 }],
      doubled: { name: 'Black rime', effects: [{ type: 'applyStatus', statusId: 'paralyzed', duration: 1 }] },
    },
    { id: 'lightning', name: 'Leaping', effects: [{ type: 'chain', maxHops: 1, hopRange: 4, damageDecay: 0.5 }] },
    { id: 'physical', name: 'Knockback', effects: [{ type: 'push', distance: 1 }], doubled: { name: 'Hard knockback', effects: [{ type: 'push', distance: 2 }] } },
    { id: 'healing', name: 'Cleansing', effects: [{ type: 'cleanse', target: 'caster' }], doubled: { name: 'Full cleansing', effects: [{ type: 'cleanse', all: true, target: 'caster' }] } },
    { id: 'arcane:Enchantment', name: 'Binding', effects: [{ type: 'applyStatus', statusId: 'paralyzed', duration: 1 }] },
    { id: 'arcane:Movement', name: 'Pull', effects: [{ type: 'pull', distance: 1 }] },
    { id: 'arcane', name: 'Piercing', effects: [] },
    { id: 'blood-price', name: 'Blood-price', effects: [], powerBonus: 0.25, hpCostPerCast: 2 },
  ],
};

/**
 * The three-grimoire model's three shapes, cut from one 3×3 grid: a row of 3, a plus of 5
 * and the full square, opening at the 4th and 9th known spell. Steps from the magic plan.
 */
export const FIXTURE_GRIMOIRES: GrimoireSystemConfig = {
  layouts: [
    {
      id: 'row',
      name: 'Row',
      cells: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
      suggestedStats: { x: 'power' },
    },
    {
      id: 'star',
      name: 'Star',
      cells: [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }],
      opensAtSpellsKnown: 4,
      openedMessage: 'A second grimoire opens: a star of five.',
    },
    {
      id: 'grid',
      name: 'Grid',
      cells: [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => ({ x, y }))),
      opensAtSpellsKnown: 9,
    },
  ],
  stats: [
    { id: 'power', name: 'Power', description: '+20% damage or healing', kind: 'power', perStep: 0.2 },
    { id: 'thrift', name: 'Thrift', description: 'a fifth off the cost', kind: 'thrift', perStep: 0.2 },
    { id: 'range', name: 'Range', description: '+2 range', kind: 'range', perStep: 2 },
    { id: 'area', name: 'Area', description: '+1 radius', kind: 'area', perStep: 1, maxStepsOnDamage: 2 },
    { id: 'duration', name: 'Duration', description: '+50% duration', kind: 'duration', perStep: 0.5 },
    { id: 'swift', name: 'Swift', description: 'casts in less of a turn', kind: 'swift', castTimeByStep: [3 / 4, 2 / 3, 1 / 2] },
  ],
  lending: FIXTURE_LENDING,
};

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
  surfaceBehaviours: { gases: { murk: { blocksSight: true } } },
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
  // A pack's wording for a summon's leaving, which must not keep it in the world.
  statusEffects: [{ id: 'summoned', name: 'Summoned', expireMessage: '{name} returns to the mist.' }],
  actionHooks: FIXTURE_ACTION_HOOKS,
  aiBehaviors: FIXTURE_AI_BEHAVIORS,
  combatConfig: { minDamage: 1, critChance: 0.15, critMultiplier: 2.0, damageVariance: 0.05 },
  progressionConfig: {
    baseXp: 120,
    xpExponent: 1.25,
    statGains: { maxHp: 8, maxMana: 6, strength: 2, intelligence: 2, constitution: 2, dexterity: 1, baseAttack: 2, baseDefense: 1 },
  },
  vaults: FIXTURE_VAULTS,
  magic: { grimoires: FIXTURE_GRIMOIRES },
};

export { FIXTURE_ACTION_HOOKS, FIXTURE_AI_BEHAVIORS };
