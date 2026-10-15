import type { SpellDefinition } from '../../engine';

/**
 * Blood: the spells the Siphon Altar gives for the captives sacrificed, mirroring the frith
 * spells it gives for the saved (frithMagic.ts). One ends a fight, one brings allies. They
 * cost the hero's own HP, which Thrift lowers, and lend Blood-price to their neighbours.
 */
export const COTW_BLOOD_SPELLS: SpellDefinition[] = [
  {
    id: 'blood_reap',
    name: 'Blood Reap',
    school: 'BloodMagic',
    lends: ['blood-price'],
    spellType: 'damage',
    manaCost: 0,
    hpCost: 4,
    maxTargetHpPercent: 0.25,
    element: 'shadow',
    range: 2,
    basePower: 30,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description:
      'Finishes a badly wounded foe within 2 tiles (25% HP or less) with 30 shadow damage, and you drink 10 HP of its life. Costs 4 HP.',
    visual: {
      fx: 'blood',
      archetype: 'projectile',
      color: '#991b1b',
      stepDelayMs: 20,
      travelMode: 'smooth',
    },
    effects: [
      { type: 'damage', amount: 30, element: 'shadow' },
      { type: 'heal', amount: 10, target: 'caster' },
    ],
  },
  {
    id: 'draugr_call',
    name: 'Draugr-call',
    school: 'BloodMagic',
    lends: ['blood-price'],
    spellType: 'control',
    manaCost: 0,
    hpCost: 6,
    element: 'shadow',
    range: 6,
    basePower: 0,
    areaOfEffect: 0,
    reflects: false,
    targetType: 'ray',
    targetingMode: 'ray',
    description:
      'Lays a death-curse on a foe for 10 turns. If it dies cursed, it rises as a draugr and fights for you for 20 turns, then crumbles. Bosses refuse it. Costs 6 HP.',
    visual: {
      fx: 'blood',
      archetype: 'projectile',
      color: '#7f1d1d',
      stepDelayMs: 22,
      travelMode: 'smooth',
    },
    statusAffliction: { type: 'rises_when_slain', duration: 10, potency: 20 },
    effects: [{ type: 'applyStatus', statusId: 'rises_when_slain', duration: 10, potency: 20 }],
  },
];
