import type { SpellDefinition } from '../../engine';

/** The Dísir's spirits: the saved kin's foremothers, summoned to stand guard (monsters/summons.ts). */
export const DISIR_SPIRIT_ID = 'disir_spirit';

/**
 * Frith (*friðr*, the sacred peace between kin): the spells the Siphon Altar gives for the
 * captives saved, mirroring the blood spells it gives for the sacrificed (bloodMagic.ts). One
 * ends a fight, one brings allies. They cost Seiðr and lend healing to their neighbours.
 */
export const COTW_FRITH_SPELLS: SpellDefinition[] = [
  {
    id: 'grith',
    name: 'Grið',
    school: 'Frith',
    lends: ['healing'],
    spellType: 'control',
    manaCost: 10,
    element: 'healing',
    range: 6,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description:
      'Grants a foe the peace of the hearth: it lays down its arms for 8 turns, fighting no one and no one\'s target. A blow breaks the peace. Bosses refuse it.',
    visual: { archetype: 'projectile', color: '#86efac', stepDelayMs: 24, travelMode: 'smooth' },
    statusAffliction: { type: 'pacified', duration: 8 },
    effects: [{ type: 'applyStatus', statusId: 'pacified', duration: 8 }],
  },
  {
    id: 'disir',
    name: 'The Dísir',
    school: 'Frith',
    lends: ['healing'],
    spellType: 'summon',
    manaCost: 14,
    element: 'healing',
    range: 0,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'self',
    targetingMode: 'self',
    description: 'Calls two of the saved kin\'s ancestral spirits to guard you for 15 turns. They fight your foes and never you.',
    visual: { archetype: 'self_buff', color: '#bbf7d0', durationMs: 240 },
    effects: [
      { type: 'summon', monsterId: DISIR_SPIRIT_ID, duration: 15, friendly: true },
      { type: 'summon', monsterId: DISIR_SPIRIT_ID, duration: 15, friendly: true },
    ],
  },
];
