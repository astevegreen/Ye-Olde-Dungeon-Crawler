import { AttributeCalculator } from '../../engine';
import type { AttributeModifier, Entity, SpellDefinition, StatusHandler, SurfaceBehaviourTable } from '../../engine';
import { RUBBLE_SURFACE } from './waveOneSpells';

/** The summons Fylgja and Rime-Thurs bring (monsters/summons.ts). */
export const FYLGJA_ID = 'fylgja_double';
export const RIME_THURS_ID = 'rime_thurs';

/** The sludge Mire lays: it drags at a step and eats at the armour of whoever stands in it. */
export const MIRE_SURFACE = 'mire';

/** On a creature standing in Mire: its armour is worn down while it lasts. */
export const MIRED_STATUS = 'cotw:mired';
/** On Fylgja's double: it bursts in a blast of dread when struck or when its time is up. */
export const FYLGJA_BURST_STATUS = 'cotw:fylgja_burst';
/** On Rime-Thurs: when he falls or his time is up, he shatters into ice. */
export const RIME_SHATTER_STATUS = 'cotw:rime_shatter';

/** A fifth of the armour is gone while a creature is mired. */
const MIRED_DEFENCE = 0.8;

/** What Mire and Drench do to the ground: Mire drags and gnaws; water has the engine's behaviour. */
export const COTW_WAVE_TWO_SURFACES: SurfaceBehaviourTable = {
  surfaces: {
    [MIRE_SURFACE]: {
      enter: { moveCost: 50, line: '{name} wades into the poison sludge!' },
      standing: {
        harm: { amount: 2, element: 'poison', cause: 'poison sludge', line: '{name} is eaten by the poison sludge for {n} damage.' },
        status: { type: MIRED_STATUS, duration: 2 },
      },
    },
  },
};

const mired = (actor: Entity): boolean => actor.statusManager?.hasStatus(MIRED_STATUS) ?? false;

const MIRED_DEFENCE_MODIFIER: AttributeModifier = {
  id: 'cotw-mired-defence',
  attributeKey: 'defense',
  phase: 'multiplier',
  apply: (currentValue, actor) => (mired(actor) ? Math.round(currentValue * MIRED_DEFENCE) : currentValue),
};

AttributeCalculator.registerModifier(MIRED_DEFENCE_MODIFIER);

export const COTW_WAVE_TWO_HANDLERS: Record<string, StatusHandler> = {
  [MIRED_STATUS]: {
    affliction: true,
    onExpire: (entity) => `${entity.name} pulls free of the sludge; its armour holds again.`,
  },
  [FYLGJA_BURST_STATUS]: {
    ending: {
      on: ['struck', 'expire'],
      message: "{name} bursts in a shriek of dread!",
      radius: 1,
      color: '#c4b5fd',
      effects: [
        { type: 'damage', amount: 10, element: 'shadow' },
        { type: 'applyStatus', statusId: 'stunned', duration: 1 },
      ],
      consumesBearer: true,
    },
    onExpire: () => undefined,
  },
  [RIME_SHATTER_STATUS]: {
    ending: {
      on: ['expire', 'slain'],
      message: '{name} shatters into a spray of ice!',
      radius: 1,
      color: '#bae6fd',
      effects: [
        { type: 'damage', amount: 14, element: 'cold' },
        { type: 'applyStatus', statusId: 'paralysis', duration: 2 },
      ],
      consumesBearer: true,
    },
    onExpire: () => undefined,
  },
};

/**
 * The second wave of the wider spell list (plan 6b): Mire, Hammer-Throw, Fylgja, Sól's Glare,
 * Raise Cairn, Rime-Thurs and Drench. A tablet by zone and a Loki ticket each; the numbers are
 * the plan's, and Raise Cairn's wall hit points are the one figure it left open.
 */
export const COTW_WAVE_TWO_SPELLS: SpellDefinition[] = [
  {
    id: 'mire',
    name: 'Mire',
    school: 'Combat',
    manaCost: 9,
    element: 'poison',
    range: 6,
    basePower: 0,
    areaOfEffect: 3,
    reflects: false,
    targetType: 'tile',
    targetingMode: 'tile',
    shape: 'square',
    description: 'Fouls a 3×3 patch of floor with poison sludge for 20 turns. Whoever stands in it moves at half pace, takes 2 poison damage a turn and has a fifth of its armour eaten away.',
    spellType: 'terrain',
    visual: { archetype: 'projectile_burst', color: '#65a30d', stepDelayMs: 24, burstRadius: 1, durationMs: 280, travelMode: 'smooth' },
    effects: [{ type: 'lay', layer: 'surface', kind: MIRE_SURFACE, duration: 20 }],
  },
  {
    id: 'hammer_throw',
    name: 'Hammer-Throw',
    school: 'Combat',
    manaCost: 9,
    element: 'lightning',
    range: 8,
    basePower: 8,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    shape: 'outAndBack',
    description: "Hurls Þórr's hammer 8 tiles through everything in its path, and it returns: each foe is struck going out and coming back, 8 lightning damage each time.",
    spellType: 'damage',
    visual: { archetype: 'projectile', color: '#facc15', stepDelayMs: 18, travelMode: 'stepped' },
    effects: [{ type: 'damage', amount: 8, element: 'lightning' }],
  },
  {
    id: 'fylgja',
    name: 'Fylgja',
    school: 'Enchantment',
    manaCost: 8,
    element: 'shadow',
    range: 0,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'self',
    targetingMode: 'self',
    description: 'Your fetch steps out of you for 10 turns and draws every foe that sees it. Struck, or when its time is up, it bursts: 10 shadow damage and a stunned turn for the foes beside it.',
    spellType: 'summon',
    visual: { archetype: 'self_buff', color: '#c4b5fd', durationMs: 240 },
    effects: [{ type: 'summon', monsterId: FYLGJA_ID, duration: 10, friendly: true, decoy: true, bears: [FYLGJA_BURST_STATUS] }],
  },
  {
    id: 'sols_glare',
    name: "Sól's Glare",
    school: 'Enchantment',
    manaCost: 7,
    element: 'fire',
    range: 6,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description: "Throws the sun's glare in a foe's eyes: it is blinded for 3 turns.",
    spellType: 'control',
    visual: { archetype: 'projectile', color: '#fde047', stepDelayMs: 20, travelMode: 'smooth' },
    statusAffliction: { type: 'blindness', duration: 3 },
    effects: [{ type: 'applyStatus', statusId: 'blindness', duration: 3 }],
  },
  {
    id: 'raise_cairn',
    name: 'Raise Cairn',
    school: 'Enchantment',
    manaCost: 9,
    element: 'physical',
    range: 6,
    basePower: 0,
    areaOfEffect: 1,
    reflects: false,
    targetType: 'tile',
    targetingMode: 'tile',
    shape: 'wall',
    description: 'Heaps a wall of stones three tiles wide across the way for 15 turns. It stops steps, sight and shots, and holds 30 blows before it crumbles to rubble.',
    spellType: 'terrain',
    visual: { archetype: 'projectile_burst', color: '#a8a29e', stepDelayMs: 26, burstRadius: 1, durationMs: 300, travelMode: 'smooth' },
    effects: [{ type: 'raise_wall', hp: 30, turns: 15, name: 'cairn', rubble: { kind: RUBBLE_SURFACE, turns: 10 } }],
  },
  {
    id: 'rime_thurs',
    name: 'Rime-Thurs',
    school: 'Combat',
    manaCost: 14,
    element: 'cold',
    range: 0,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'self',
    targetingMode: 'self',
    description: 'A frost giant answers for 12 turns and fights your foes. When it falls or its time is up it shatters into ice: 14 cold damage and two frozen turns for the foes beside it.',
    spellType: 'summon',
    visual: { archetype: 'self_buff', color: '#bae6fd', durationMs: 240 },
    effects: [{ type: 'summon', monsterId: RIME_THURS_ID, duration: 12, friendly: true, bears: [RIME_SHATTER_STATUS] }],
  },
  {
    id: 'drench',
    name: 'Drench',
    school: 'Combat',
    manaCost: 5,
    element: 'cold',
    range: 6,
    basePower: 0,
    areaOfEffect: 3,
    reflects: false,
    targetType: 'tile',
    targetingMode: 'tile',
    shape: 'square',
    description: 'Floods a 3×3 patch of floor for 25 turns. Lightning that finds a creature standing in it strikes twice as hard.',
    spellType: 'terrain',
    visual: { archetype: 'projectile_burst', color: '#38bdf8', stepDelayMs: 24, burstRadius: 1, durationMs: 280, travelMode: 'smooth' },
    effects: [{ type: 'lay', layer: 'surface', kind: 'water', duration: 25 }],
  },
];
