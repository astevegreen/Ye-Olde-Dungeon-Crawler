import type { ChoiceDefinition, LevelMilestoneTrigger, PerkDefinition } from '../../engine';

/**
 * Perks (tracker 3.6; Q27 "Separate sources.", lists approved Q51–Q53, 2026-10-04). Three
 * sources, one vocabulary: each perk's `effects` are item-modifier fields read where worn
 * items are read (`manifest.perks`, `PerkDefinition`).
 *
 * Saga perks come at levels 10, 20, 30, 40 and 50, three to choose from each
 * (`COTW_LEVEL_MILESTONES`); the tiers below are those built so far. Numbers are first
 * guesses, tuned by measurement.
 *
 * Not yet built from the approved list: Wayfarer's "sight +1" (the sight radius is computed in
 * a protected file, ARCHITECTURE.md §8.1; asked of the owner), Saga tiers 30–50, the milestone
 * 25 and 30 tiers, and the eight family perks.
 */
export const COTW_PERKS: PerkDefinition[] = [
  // ── Saga, level 10: the first path ──
  {
    id: 'saga_berserkergang',
    name: 'Berserkergang',
    source: 'saga',
    tagline: 'Rage grows as the blood runs.',
    description: 'Melee damage +20%, and +40% while below half health.',
    effects: { meleeDamageMultiplier: 1.2, belowHalfHpMeleeMultiplier: 1.4 },
  },
  {
    id: 'saga_seidr_woven',
    name: 'Seiðr-Woven',
    source: 'saga',
    tagline: 'The weave answers a lighter hand.',
    description: 'Spells cost 20% less {mana} and hit 10% harder.',
    effects: { manaCostMultiplier: 0.8, spellDamageMultiplier: 1.1 },
  },
  {
    id: 'saga_wayfarer',
    name: 'Wayfarer',
    source: 'saga',
    tagline: 'Every road has told you its secrets.',
    description: 'Evasion +10%; traps and secret doors are found from twice as far.',
    effects: { evasionBonus: 0.1, perceptionRadiusMultiplier: 2 },
  },
  // ── Saga, level 20 ──
  {
    id: 'saga_shield_wall',
    name: 'Shield-Wall',
    source: 'saga',
    tagline: 'Planted like the first rank at Stamford.',
    description: 'Melee damage taken −15%, and no blow can knock you back.',
    effects: { meleeDamageTakenMultiplier: 0.85, impulseImmune: true },
  },
  {
    id: 'saga_blood_drinker',
    name: 'Blood-Drinker',
    source: 'saga',
    tagline: 'Each death feeds the next fight.',
    description: 'Each kill heals 10% of your max health.',
    effects: { killHealPercent: 0.1 },
  },
  {
    id: 'saga_spell_thief',
    name: 'Spell-Thief',
    source: 'saga',
    tagline: 'The dying breath is yours to spend.',
    description: 'Each kill restores 10% of your max {mana}, and overflow debt clears twice as fast when you rest.',
    effects: { killManaPercent: 0.1, overflowDebtDecayMultiplier: 2 },
  },
];

const grant = (perkId: string) => ({ type: 'grantPerk' as const, perkId });
const option = (perk: PerkDefinition) => ({
  id: perk.id,
  label: perk.name,
  description: perk.description,
  consequences: [grant(perk.id), { type: 'logMessage' as const, message: `${perk.tagline ?? perk.name} The saga names you: ${perk.name}.` }],
});
const perk = (id: string): PerkDefinition => COTW_PERKS.find((p) => p.id === id)!;

export const COTW_SAGA_CHOICES: Record<string, ChoiceDefinition> = {
  saga_10: {
    id: 'saga_10',
    title: 'The First Path',
    description:
      'Ten levels under Bjarnarhaven, and the skalds have begun to notice. A saga wants a shape. Which will yours take? This cannot be unchosen.',
    options: [option(perk('saga_berserkergang')), option(perk('saga_seidr_woven')), option(perk('saga_wayfarer'))],
    cancelable: false,
  },
  saga_20: {
    id: 'saga_20',
    title: 'The Second Verse',
    description:
      'Twenty levels, and the dead of the Dwarven Works know your tread. The second verse of your saga is yours to set. This cannot be unchosen.',
    options: [option(perk('saga_shield_wall')), option(perk('saga_blood_drinker')), option(perk('saga_spell_thief'))],
    cancelable: false,
  },
};

export const COTW_LEVEL_MILESTONES: LevelMilestoneTrigger[] = [
  { id: 'saga_10', level: 10, choiceId: 'saga_10' },
  { id: 'saga_20', level: 20, choiceId: 'saga_20' },
];
