import type { SpellDefinition, SurfaceBehaviourTable } from '../../engine';

/** The wolves Call the Pack brings (monsters/summons.ts). */
export const PACK_WOLF_ID = 'pack_wolf';

/** The cloud Shroud of Máni lays: it hides what is inside and behind it. */
export const SHROUD_GAS = 'mani_shroud';

/** The rubble Rockfall leaves: it drags at a step like mud. */
export const RUBBLE_SURFACE = 'rubble';

/** What the wave-1 ground does: rubble slows, the shroud blocks sight. Rime Floor lays the engine's ice sheet. */
export const COTW_WAVE_ONE_SURFACES: SurfaceBehaviourTable = {
  surfaces: {
    [RUBBLE_SURFACE]: { enter: { moveCost: 50, line: '{name} stumbles over the fallen rubble!' } },
  },
  gases: {
    [SHROUD_GAS]: { blocksSight: true },
  },
};

/**
 * The first wave of the wider spell list (plan 4c-2): six spells built from the engine's
 * shapes, delayed blasts, ground and summons. A tablet by zone and a Loki ticket each; the
 * numbers are the plan's.
 */
export const COTW_WAVE_ONE_SPELLS: SpellDefinition[] = [
  {
    id: 'fafnirs_breath',
    name: "Fáfnir's Breath",
    school: 'Combat',
    manaCost: 8,
    element: 'poison',
    range: 3,
    basePower: 4,
    areaOfEffect: 3,
    reflects: false,
    targetType: 'tile',
    targetingMode: 'cone',
    shape: 'cone',
    description: "Exhales the dragon's venom in a cone three tiles long: 4 poison damage and a lingering poison on every foe in it.",
    spellType: 'damage',
    visual: { archetype: 'projectile_burst', color: '#84cc16', stepDelayMs: 24, burstRadius: 1, durationMs: 260, travelMode: 'smooth' },
    statusAffliction: { type: 'poison', duration: 4 },
    effects: [
      { type: 'damage', amount: 4, element: 'poison' },
      { type: 'applyStatus', statusId: 'poison', duration: 4 },
    ],
  },
  {
    id: 'call_the_pack',
    name: 'Call the Pack',
    school: 'Combat',
    manaCost: 10,
    element: 'physical',
    range: 0,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'self',
    targetingMode: 'self',
    description: 'Two wolves of the pack answer for 15 turns. They fight your foes and never you.',
    spellType: 'summon',
    visual: { archetype: 'self_buff', color: '#d6d3d1', durationMs: 240 },
    effects: [
      { type: 'summon', monsterId: PACK_WOLF_ID, duration: 15, friendly: true },
      { type: 'summon', monsterId: PACK_WOLF_ID, duration: 15, friendly: true },
    ],
  },
  {
    id: 'rockfall',
    name: 'Rockfall',
    school: 'Combat',
    manaCost: 10,
    element: 'physical',
    range: 6,
    basePower: 22,
    areaOfEffect: 3,
    reflects: false,
    targetType: 'tile',
    targetingMode: 'tile',
    shape: 'square',
    delay: 1,
    description: 'Marks a 3×3 patch of ceiling. Next turn it falls: 22 damage and a stunned turn for whoever stayed, and rubble that drags at a step like mud.',
    spellType: 'damage',
    visual: { archetype: 'projectile_burst', color: '#a8a29e', stepDelayMs: 26, burstRadius: 1, durationMs: 300, travelMode: 'smooth' },
    effects: [
      { type: 'damage', amount: 22, element: 'physical' },
      { type: 'applyStatus', statusId: 'stunned', duration: 1 },
      { type: 'lay', layer: 'surface', kind: RUBBLE_SURFACE, duration: 20 },
    ],
  },
  {
    id: 'thunderclap',
    name: 'Thunderclap',
    school: 'Combat',
    manaCost: 10,
    element: 'lightning',
    range: 0,
    basePower: 8,
    areaOfEffect: 1,
    reflects: false,
    targetType: 'self',
    targetingMode: 'self',
    shape: 'nova',
    description: 'A clap of thunder rings out from you: every foe around is thrown back 3 tiles, then struck for 8 lightning damage and stunned for a turn.',
    spellType: 'damage',
    visual: { archetype: 'screen_flash', color: '#facc15', durationMs: 260 },
    effects: [
      { type: 'push', distance: 3 },
      { type: 'damage', amount: 8, element: 'lightning' },
      { type: 'applyStatus', statusId: 'stunned', duration: 1 },
    ],
  },
  {
    id: 'shroud_of_mani',
    name: 'Shroud of Máni',
    school: 'Enchantment',
    manaCost: 6,
    element: 'shadow',
    range: 6,
    basePower: 0,
    areaOfEffect: 4,
    reflects: false,
    targetType: 'tile',
    targetingMode: 'tile',
    shape: 'square',
    description: "Máni draws a veil over a 4×4 patch for 15 turns: nothing can be seen into, out of or through it.",
    spellType: 'terrain',
    visual: { archetype: 'projectile_burst', color: '#7c3aed', stepDelayMs: 24, burstRadius: 2, durationMs: 300, travelMode: 'smooth' },
    effects: [{ type: 'lay', layer: 'gas', kind: SHROUD_GAS, duration: 15 }],
  },
  {
    id: 'rime_floor',
    name: 'Rime Floor',
    school: 'Enchantment',
    manaCost: 5,
    element: 'cold',
    range: 6,
    basePower: 0,
    areaOfEffect: 3,
    reflects: false,
    targetType: 'tile',
    targetingMode: 'tile',
    shape: 'square',
    description: 'Glazes a 3×3 patch of floor with ice for 15 turns. Whoever steps on it slides 2 tiles on and loses half a turn.',
    spellType: 'terrain',
    visual: { archetype: 'projectile_burst', color: '#bae6fd', stepDelayMs: 24, burstRadius: 1, durationMs: 280, travelMode: 'smooth' },
    effects: [{ type: 'lay', layer: 'surface', kind: 'ice_sheet', duration: 15 }],
  },
];
