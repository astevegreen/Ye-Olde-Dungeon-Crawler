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

export const COTW_MILESTONE_PERKS: PerkDefinition[] = [
  // ── Strength 20 ──
  { id: 'milestone_ox_shoulders', name: 'Ox-Shoulders', source: 'milestone', tagline: 'A yoke sits light on you.', description: 'You carry half again as much, and your knock-backs throw a foe a tile farther.', effects: { carryMultiplier: 1.5, knockbackBonus: 1 } },
  { id: 'milestone_bone_breaker', name: 'Bone-Breaker', source: 'milestone', tagline: 'Where you strike, something gives.', description: 'One melee hit in four slows the foe for a turn.', effects: { onHitStatus: { status: 'slow', chance: 0.25, duration: 1 } } },
  // ── Dexterity 20 ──
  { id: 'milestone_fleet_foot', name: 'Fleet-Foot', source: 'milestone', tagline: 'The frost never quite catches you.', description: 'Speed +10, for good.' },
  { id: 'milestone_sure_shot', name: 'Sure Shot', source: 'milestone', tagline: 'The arrow knows the way.', description: 'Ranged hit chance +15% and ranged damage +2.', effects: { rangedHitBonus: 15, rangedDamageBonus: 2 } },
  // ── Constitution 20 ──
  { id: 'milestone_thick_hide', name: 'Thick Hide', source: 'milestone', tagline: 'Blows land, and slide off.', description: 'All damage taken −10%.', effects: { damageTakenMultiplier: 0.9 } },
  { id: 'milestone_iron_stomach', name: 'Iron Stomach', source: 'milestone', tagline: 'Venom and flame find little purchase.', description: 'Poison and burning last half as long on you.', effects: { shortenedAfflictions: { types: ['poison', 'burning'], multiplier: 0.5 } } },
  // ── Intelligence 20 ──
  { id: 'milestone_rune_thrift', name: 'Rune-Thrift', source: 'milestone', tagline: 'No rune drawn larger than it must be.', description: 'Spells cost 15% less {mana}.', effects: { manaCostMultiplier: 0.85 } },
  { id: 'milestone_lore_keeper', name: 'Lore-Keeper', source: 'milestone', tagline: 'Handle a thing a while and it tells you its name.', description: 'Taking the stairs identifies every unidentified item you have carried since the last stairs.', effects: { identifiesCarriedOnStairs: true } },
];

const grant = (perkId: string) => ({ type: 'grantPerk' as const, perkId });
const option = (perk: PerkDefinition) => ({
  id: perk.id,
  label: perk.name,
  description: perk.description,
  consequences: [grant(perk.id), { type: 'logMessage' as const, message: `${perk.tagline ?? perk.name} The saga names you: ${perk.name}.` }],
});
const perk = (id: string): PerkDefinition => [...COTW_PERKS, ...COTW_MILESTONE_PERKS].find((p) => p.id === id)!;
const milestoneOption = (perk: PerkDefinition, extra: ChoiceDefinition['options'][number]['consequences'] = []) => ({
  id: perk.id,
  label: perk.name,
  description: perk.description,
  consequences: [grant(perk.id), ...extra, { type: 'logMessage' as const, message: `${perk.tagline ?? perk.name} You take up ${perk.name}.` }],
});

/** The attribute milestones' perk choices (Q52 "A"; tier 20 so far, 25 and 30 to follow). */
export const COTW_MILESTONE_CHOICES: Record<string, ChoiceDefinition> = {
  milestone_str_20: {
    id: 'milestone_str_20',
    title: 'Strength Milestone: Might of the Mountain Giant',
    description:
      'Your muscles surge with the brute vigor of the hill giants. Stone breaks beneath your grip. Will you bear the weight of a wagon, or break what you strike?',
    options: [milestoneOption(perk('milestone_ox_shoulders')), milestoneOption(perk('milestone_bone_breaker'))],
    cancelable: false,
  },
  milestone_dex_20: {
    id: 'milestone_dex_20',
    title: 'Dexterity Milestone: Mastery of the Swift Wind',
    description:
      'Your hands move with uncanny swiftness and your step makes no sound upon the frost. The spirits of the hunt take note of your nimble blood. Will you outrun the cold, or never miss a mark?',
    options: [milestoneOption(perk('milestone_fleet_foot'), [{ type: 'modifyPermanentStat', stat: 'speed', delta: 10 }]), milestoneOption(perk('milestone_sure_shot'))],
    cancelable: false,
  },
  milestone_con_20: {
    id: 'milestone_con_20',
    title: 'Constitution Milestone: Vigor of the Ancient Oak',
    description:
      'The bitter cold of the deep north cannot chill your veins. Your flesh is hard as bog iron and your heart beats with unyielding endurance. Will you turn aside the blow, or shrug off the venom?',
    options: [milestoneOption(perk('milestone_thick_hide')), milestoneOption(perk('milestone_iron_stomach'))],
    cancelable: false,
  },
  milestone_int_20: {
    id: 'milestone_int_20',
    title: 'Intelligence Milestone: Runic Illumination',
    description:
      'The whispered wisdom of Mimir and the secrets of the Elder Futhark burn into your consciousness. Will you draw your runes smaller, or read the ones on everything you carry?',
    options: [milestoneOption(perk('milestone_rune_thrift')), milestoneOption(perk('milestone_lore_keeper'))],
    cancelable: false,
  },
};

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
