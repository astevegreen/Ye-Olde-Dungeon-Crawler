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
 * The Third Verse's Elementalist chooses its element in a second choice, offered on the next
 * move (`saga_30_element`, waiting on its flag).
 *
 * Waiting on the owner: Shadow-Walker's "a monster that cannot see you does not wake" (Q57;
 * sleepers wake in the hero's sight, computed in a protected file) and Odin's Eye's ranged
 * range (Q59; no ranged attack can be made in play). Not yet built from the approved list: the
 * eight family perks.
 */
/** The elements an Elementalist may choose (cotw's damaging elements), with their names. */
const ELEMENTALIST_ELEMENTS: Array<[string, string]> = [
  ['fire', 'Fire'],
  ['cold', 'Cold'],
  ['lightning', 'Lightning'],
  ['poison', 'Poison'],
  ['arcane', 'Arcane'],
];

/** Set by the Third Verse's Elementalist; the element choice waits on it. */
const ELEMENTALIST_FLAG = 'saga_elementalist';

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
    description: 'Sight +1, evasion +10%; traps and secret doors are found from twice as far.',
    effects: { sightBonus: 1, evasionBonus: 0.1, perceptionRadiusMultiplier: 2 },
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
  // ── Saga, level 30 ──
  {
    id: 'saga_twin_fangs',
    name: 'Twin Fangs',
    source: 'saga',
    tagline: 'The second blade follows the first like a wolf its mate.',
    description: 'Each melee attack strikes a second time, for half damage.',
    effects: { followUpStrikeShare: 0.5 },
  },
  ...ELEMENTALIST_ELEMENTS.map(
    ([element, name]): PerkDefinition => ({
      id: `saga_elementalist_${element}`,
      name: `Elementalist (${name})`,
      source: 'saga',
      tagline: `${name} answers you as kin.`,
      description: `Your ${element} spells hit 30% harder, and you resist ${element}.`,
      effects: { elementSpellMultiplier: { element, multiplier: 1.3 }, resistsElements: [element] },
    })
  ),
  {
    id: 'saga_beast_friend',
    name: 'Beast-Friend',
    source: 'saga',
    tagline: 'What runs beside you runs stronger.',
    description: 'Your companion has half again its health and attack, and once each floor a fallen companion rises again.',
    effects: { companionStatMultiplier: 1.5, companionRisesPerFloor: true },
  },
  // ── Saga, level 40 ──
  {
    id: 'saga_einherjar',
    name: 'Einherjar',
    source: 'saga',
    tagline: 'Odin has a bench kept for you, and is in no hurry to fill it.',
    description: 'Once on each floor, a blow that would kill you leaves you at 1 HP.',
    effects: { lastStandPerFloor: true },
  },
  {
    id: 'saga_galdr_master',
    name: 'Galdr-Master',
    source: 'saga',
    tagline: 'Every rune you set sings with its neighbours.',
    description: 'Every spell hits 20% harder, and each grimoire synergy between neighbouring slots counts twice.',
    effects: { spellDamageMultiplier: 1.2, grimoireSynergyRepeats: 1 },
  },
  {
    id: 'saga_shadow_walker',
    name: 'Shadow-Walker',
    source: 'saga',
    tagline: 'Where the torchlight ends, so do you.',
    description: 'Evasion +20%.',
    effects: { evasionBonus: 0.2 },
  },
  // ── Saga, level 50: the summit ──
  {
    id: 'saga_jarl_of_the_deep',
    name: 'Jarl of the Deep',
    source: 'saga',
    tagline: 'The roots of the world answer to you now.',
    description: '+2 to every attribute, for good.',
  },
  {
    id: 'saga_odins_eye',
    name: 'Odin’s Eye',
    source: 'saga',
    tagline: 'One eye in the well, one on everything else.',
    description: 'Every monster on the floor is shown on the map, through walls, and your spells reach 2 tiles farther.',
    effects: { sensesAllMonsters: true, spellRangeBonus: 2 },
  },
  {
    id: 'saga_thors_wrath',
    name: 'Thor’s Wrath',
    source: 'saga',
    tagline: 'Every fourth blow falls like Mjölnir.',
    description: 'One melee blow in four is a critical, for double damage.',
    effects: { critChanceBonus: 0.25, critMultiplier: 2 },
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
  // ── Strength 25 ──
  { id: 'milestone_sunder', name: 'Sunder', source: 'milestone', tagline: 'Mail parts like linen.', description: 'Your melee ignores a quarter of the foe’s defense.', effects: { defensePenetration: 0.25 } },
  { id: 'milestone_giants_grip', name: 'Giant’s Grip', source: 'milestone', tagline: 'One hand is enough for what others need two for.', description: 'You may carry a shield beside a two-handed weapon.', effects: { shieldWithTwoHanded: true } },
  // ── Dexterity 25 ──
  { id: 'milestone_riposte', name: 'Riposte', source: 'milestone', tagline: 'Every miss is an opening.', description: 'Each time you evade a melee blow, you strike back, free.', effects: { ripostesOnEvade: true } },
  { id: 'milestone_trap_dancer', name: 'Trap-Dancer', source: 'milestone', tagline: 'Your feet find the safe stones first.', description: 'Traps never trigger under you.', effects: { trapImmune: true } },
  // ── Constitution 25 ──
  { id: 'milestone_second_wind', name: 'Second Wind', source: 'milestone', tagline: 'A breath, and you are whole again.', description: 'Resting heals twice as fast.', effects: { restHealMultiplier: 2 } },
  { id: 'milestone_stalwart', name: 'Stalwart', source: 'milestone', tagline: 'Nothing slows the oak.', description: 'You cannot be slowed or stunned.', effects: { grantsStatusImmunities: ['slow', 'stunned'] } },
  // ── Intelligence 25 ──
  { id: 'milestone_chain_weaver', name: 'Chain-Weaver', source: 'milestone', tagline: 'The lightning knows one more name.', description: 'Your chain spells reach one more foe.', effects: { chainExtraHops: 1 } },
  { id: 'milestone_warding_glyph', name: 'Warding Glyph', source: 'milestone', tagline: 'A rune under the skin, waiting.', description: 'On each floor, the first spell to hit you is halved.', effects: { firstSpellPerFloorMultiplier: 0.5 } },
  // ── Strength 30 ──
  { id: 'milestone_mountains_root', name: 'Mountain’s Root', source: 'milestone', tagline: 'You stand as the mountains stand.', description: 'Max health +15%, and no blow can knock you back.', effects: { maxHpPercent: 0.15, impulseImmune: true } },
  { id: 'milestone_hammer_of_thor', name: 'Hammer of Thor', source: 'milestone', tagline: 'Every blow lands like thunder.', description: 'Melee damage +25%.', effects: { meleeDamageMultiplier: 1.25 } },
  // ── Dexterity 30 ──
  { id: 'milestone_shadow_step', name: 'Shadow-Step', source: 'milestone', tagline: 'Where the blade fell, you were.', description: 'Evasion +10%, and each blow you evade lets you slip a tile aside.', effects: { evasionBonus: 0.1, evadeBlinkRange: 1 } },
  { id: 'milestone_deadly_precision', name: 'Deadly Precision', source: 'milestone', tagline: 'You strike where the armour isn’t.', description: 'One melee blow in five is a critical, for half again the damage.', effects: { critChanceBonus: 0.2, critMultiplier: 1.5 } },
  // ── Constitution 30 ──
  { id: 'milestone_undying', name: 'Undying', source: 'milestone', tagline: 'Every step down makes you whole.', description: 'A level-up heals you in full.', effects: { levelUpFullHeal: true } },
  { id: 'milestone_juggernaut', name: 'Juggernaut', source: 'milestone', tagline: 'More of you than any blade can reach.', description: 'Max health +25%.', effects: { maxHpPercent: 0.25 } },
  // ── Intelligence 30 ──
  { id: 'milestone_arch_seidkona', name: 'Arch-Seiðkona', source: 'milestone', tagline: 'The void obeys before it bites.', description: 'Overflow surges come a tier milder; the mildest never comes at all.', effects: { overflowTierShift: -1 } },
  { id: 'milestone_mind_over_matter', name: 'Mind over Matter', source: 'milestone', tagline: 'You see the blow before it is thought of.', description: 'Intelligence also adds to evasion, 1% a point above 10.', effects: { evasionPerIntelligence: 0.01 } },
];

const grant = (perkId: string) => ({ type: 'grantPerk' as const, perkId });
const option = (perk: PerkDefinition, extra: ChoiceDefinition['options'][number]['consequences'] = []) => ({
  id: perk.id,
  label: perk.name,
  description: perk.description,
  consequences: [grant(perk.id), ...extra, { type: 'logMessage' as const, message: `${perk.tagline ?? perk.name} The saga names you: ${perk.name}.` }],
});
const perk = (id: string): PerkDefinition => [...COTW_PERKS, ...COTW_MILESTONE_PERKS].find((p) => p.id === id)!;
const milestoneOption = (perk: PerkDefinition, extra: ChoiceDefinition['options'][number]['consequences'] = []) => ({
  id: perk.id,
  label: perk.name,
  description: perk.description,
  consequences: [grant(perk.id), ...extra, { type: 'logMessage' as const, message: `${perk.tagline ?? perk.name} You take up ${perk.name}.` }],
});

const milestoneChoice = (id: string, title: string, description: string, a: string, b: string): ChoiceDefinition => ({
  id,
  title,
  description,
  options: [milestoneOption(perk(a)), milestoneOption(perk(b))],
  cancelable: false,
});

/** The attribute milestones' perk choices at 20, 25 and 30 (Q52 "A"). */
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
  milestone_str_25: milestoneChoice(
    'milestone_str_25',
    'Strength Milestone: The Jötunn’s Reach',
    'Iron bends where you close your hand, and the troll-wives would envy your shoulders. Will you break through what armours them, or carry a giant’s blade in one hand?',
    'milestone_sunder',
    'milestone_giants_grip'
  ),
  milestone_dex_25: milestoneChoice(
    'milestone_dex_25',
    'Dexterity Milestone: The Dancer on the Ice',
    'You move the way the north wind moves over a frozen lake: never where the blow is aimed. Will you answer every miss with steel, or never set off a trap again?',
    'milestone_riposte',
    'milestone_trap_dancer'
  ),
  milestone_con_25: milestoneChoice(
    'milestone_con_25',
    'Constitution Milestone: The Unbowed Pine',
    'Snow loads your branches and slides off them. Will you mend faster when you rest, or never be slowed or staggered?',
    'milestone_second_wind',
    'milestone_stalwart'
  ),
  milestone_int_25: milestoneChoice(
    'milestone_int_25',
    'Intelligence Milestone: The Woven Runes',
    'The runes you draw have begun to draw each other. Will your chains reach one more foe, or will a glyph under your skin blunt the first spell cast at you on each floor?',
    'milestone_chain_weaver',
    'milestone_warding_glyph'
  ),
  milestone_str_30: milestoneChoice(
    'milestone_str_30',
    'Strength Milestone: The Mountain’s Heart',
    'The roots of the mountain run in your arms now. Will you stand where no blow can move you, or strike like the Thunderer himself?',
    'milestone_mountains_root',
    'milestone_hammer_of_thor'
  ),
  milestone_dex_30: milestoneChoice(
    'milestone_dex_30',
    'Dexterity Milestone: The Shadow Between Blows',
    'You are never quite where the eye says you are. Will you melt aside from every blow you dodge, or strike through the gaps in every guard?',
    'milestone_shadow_step',
    'milestone_deadly_precision'
  ),
  milestone_con_30: milestoneChoice(
    'milestone_con_30',
    'Constitution Milestone: The World-Ash’s Sap',
    'Yggdrasil’s sap runs in you as it runs in the roots you walk among. Will every level make you whole again, or will there simply be more of you to cut?',
    'milestone_undying',
    'milestone_juggernaut'
  ),
  milestone_int_30: milestoneChoice(
    'milestone_int_30',
    'Intelligence Milestone: Mimir’s Well',
    'You have drunk from deeper than the runes go. Will the void’s surges bow to you, or will your mind turn aside the blows your body cannot?',
    'milestone_arch_seidkona',
    'milestone_mind_over_matter'
  ),
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
  saga_30: {
    id: 'saga_30',
    title: 'The Third Verse',
    description:
      'Thirty levels, and the silver deeps have learned to fear your name. The third verse asks what kind of terror you will be. This cannot be unchosen.',
    options: [
      option(perk('saga_twin_fangs')),
      {
        id: 'saga_elementalist',
        label: 'Elementalist',
        description: 'Choose an element: your spells of it hit 30% harder, and you resist it.',
        consequences: [
          { type: 'setFlag', flag: ELEMENTALIST_FLAG, value: true },
          { type: 'logMessage', message: 'The elements stir and wait to learn which of them you will call kin.' },
        ],
      },
      option(perk('saga_beast_friend')),
    ],
    cancelable: false,
  },
  saga_30_element: {
    id: 'saga_30_element',
    title: 'The Elementalist’s Kin',
    description: 'One element will answer you as kin: its spells strike harder from your hand, and it bites you less. Which?',
    options: ELEMENTALIST_ELEMENTS.map(([element]) => option(perk(`saga_elementalist_${element}`))),
    cancelable: false,
  },
  saga_40: {
    id: 'saga_40',
    title: 'The Fourth Verse',
    description:
      'Forty levels, and the Valkyries have begun to argue over you. The fourth verse is the one the skalds will sing loudest. This cannot be unchosen.',
    options: [option(perk('saga_einherjar')), option(perk('saga_galdr_master')), option(perk('saga_shadow_walker'))],
    cancelable: false,
  },
  saga_50: {
    id: 'saga_50',
    title: 'The Summit of the Saga',
    description:
      'Fifty levels. There is no verse after this one; there is only how it ends. Choose the shape of the last line. This cannot be unchosen.',
    options: [
      option(perk('saga_jarl_of_the_deep'), [
        { type: 'modifyAttribute', attribute: 'strength', delta: 2 },
        { type: 'modifyAttribute', attribute: 'dexterity', delta: 2 },
        { type: 'modifyAttribute', attribute: 'constitution', delta: 2 },
        { type: 'modifyAttribute', attribute: 'intelligence', delta: 2 },
      ]),
      option(perk('saga_odins_eye')),
      option(perk('saga_thors_wrath')),
    ],
    cancelable: false,
  },
};


export const COTW_LEVEL_MILESTONES: LevelMilestoneTrigger[] = [
  { id: 'saga_10', level: 10, choiceId: 'saga_10' },
  { id: 'saga_20', level: 20, choiceId: 'saga_20' },
  { id: 'saga_30', level: 30, choiceId: 'saga_30' },
  { id: 'saga_30_element', level: 30, choiceId: 'saga_30_element', when: { type: 'hasFlag', flag: ELEMENTALIST_FLAG } },
  { id: 'saga_40', level: 40, choiceId: 'saga_40' },
  { id: 'saga_50', level: 50, choiceId: 'saga_50' },
];
