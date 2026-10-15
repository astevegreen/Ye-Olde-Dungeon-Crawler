import type { GrimoireSystemConfig, NeighbourLendingConfig } from '../../engine';
import { COTW_ESSENCE_BY_ELEMENT } from './items/essences';

/**
 * What touching slots lend each other, after the magic plan's neighbour rules (15 Oct): one
 * flavour per element, arcane by school, Blood-price, and a doubled form for each, lent to
 * a spell of the flavour's own element or from a slot doubled at Týr's Oath-Stone.
 */
const COTW_LENDING: NeighbourLendingConfig = {
  lendBySchool: ['arcane'],
  oppositeBonus: 0.25,
  flavours: [
    {
      id: 'fire',
      name: 'Burning',
      effects: [{ type: 'applyStatus', statusId: 'burning', duration: 2 }],
      doubled: { name: 'Muspel-fire', color: '#60a5fa', effects: [{ type: 'applyStatus', statusId: 'burning', duration: 4 }] },
    },
    {
      id: 'cold',
      name: 'Chill',
      effects: [{ type: 'applyStatus', statusId: 'slow', duration: 2 }],
      doubled: { name: 'Black rime', color: '#1e293b', effects: [{ type: 'applyStatus', statusId: 'paralysis', duration: 1 }] },
    },
    {
      id: 'lightning',
      name: 'Leaping',
      effects: [{ type: 'chain', maxHops: 1, hopRange: 4, damageDecay: 0.5 }],
      doubled: { name: 'Forked lightning', color: '#e0f2fe', effects: [{ type: 'chain', maxHops: 2, hopRange: 4, damageDecay: 0.5 }] },
    },
    {
      id: 'poison',
      name: 'Venom',
      effects: [{ type: 'applyStatus', statusId: 'poison', duration: 2 }],
      doubled: { name: "Fáfnir's venom", color: '#365314', effects: [{ type: 'applyStatus', statusId: 'poison', duration: 4 }] },
    },
    {
      id: 'physical',
      name: 'Knockback',
      effects: [{ type: 'push', distance: 1 }],
      doubled: { name: 'Hard knockback', color: '#a8a29e', effects: [{ type: 'push', distance: 2 }] },
    },
    {
      id: 'shadow',
      name: 'Drain',
      effects: [{ type: 'heal', amount: 3, target: 'caster' }],
      doubled: { name: 'Deep drain', color: '#581c87', effects: [{ type: 'heal', amount: 6, target: 'caster' }] },
    },
    {
      id: 'healing',
      name: 'Cleansing',
      effects: [{ type: 'cleanse', target: 'caster' }],
      doubled: { name: 'Full cleansing', color: '#bbf7d0', effects: [{ type: 'cleanse', all: true, target: 'caster' }] },
    },
    {
      id: 'arcane:Enchantment',
      name: 'Binding',
      effects: [{ type: 'applyStatus', statusId: 'paralysis', duration: 1 }],
      doubled: { name: 'Hard binding', color: '#fbbf24', effects: [{ type: 'applyStatus', statusId: 'paralysis', duration: 2 }] },
    },
    {
      // Phase Door blinks whatever its neighbour hits; it never moves the caster.
      id: 'arcane:Movement',
      name: 'Blink',
      effects: [{ type: 'teleport', range: 2, random: true }],
      doubled: { name: 'Far blink', color: '#c084fc', effects: [{ type: 'teleport', range: 4, random: true }] },
    },
    {
      id: 'arcane:Divination',
      name: 'Mark',
      effects: [{ type: 'applyStatus', statusId: 'marked', duration: 10 }],
      doubled: { name: 'Deep mark', color: '#67e8f9', effects: [{ type: 'applyStatus', statusId: 'marked', duration: 20 }] },
    },
    // Magic Arrow's pierce: named here, delivered once a lend can shape the borrower's hit.
    { id: 'arcane:Combat', name: 'Piercing', effects: [] },
    { id: 'blood-price', name: 'Blood-price', effects: [], powerBonus: 0.25, hpCostPerCast: 2 },
  ],
};

/**
 * Máni, Sól and Yggdrasil: a row of 3, a plus of 5 and the full 3×3, cut from one grid
 * and opening at the 4th and 9th known spell. Stat steps from the magic plan (15 Oct).
 */
export const COTW_GRIMOIRES: GrimoireSystemConfig = {
  layouts: [
    {
      id: 'mani',
      name: 'Máni',
      cells: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }],
      suggestedStats: { x: 'power' },
    },
    {
      id: 'sol',
      name: 'Sól',
      cells: [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }],
      opensAtSpellsKnown: 4,
      suggestedStats: { x: 'duration', y: 'thrift' },
      openedMessage: "Sól's grimoire opens: a centre and four arms. Choose the stats its arms give.",
    },
    {
      id: 'yggdrasil',
      name: 'Yggdrasil',
      cells: [-1, 0, 1].flatMap((y) => [-1, 0, 1].map((x) => ({ x, y }))),
      opensAtSpellsKnown: 9,
      suggestedStats: { x: 'range', y: 'area' },
      openedMessage: "Yggdrasil's grimoire opens: the nine worlds, Midgard in the middle. Choose the stats its edges give.",
    },
  ],
  stats: [
    { id: 'power', name: 'Power', description: '+20% damage or healing per step', kind: 'power', perStep: 0.2 },
    { id: 'thrift', name: 'Thrift', description: 'a fifth off the Seiðr or HP cost per step', kind: 'thrift', perStep: 0.2 },
    { id: 'range', name: 'Range', description: '+2 tiles of reach per step', kind: 'range', perStep: 2 },
    { id: 'area', name: 'Area', description: '+1 blast radius per step, at most 2 on a damage spell', kind: 'area', perStep: 1, maxStepsOnDamage: 2 },
    { id: 'duration', name: 'Duration', description: 'statuses, summons and ground last half again as long per step', kind: 'duration', perStep: 0.5 },
    { id: 'swift', name: 'Swift', description: 'casts in ¾, then ⅔, then ½ of a turn', kind: 'swift', castTimeByStep: [3 / 4, 2 / 3, 1 / 2] },
  ],
  lending: COTW_LENDING,
  // The old fusions' names live on as titles: "Cold Ray, steam-forged".
  forging: {
    titles: {
      'cold+fire': 'steam',
      'fire+lightning': 'Surtr',
      'cold+lightning': 'hail',
      'arcane+fire': 'rune',
      'arcane+cold': 'rime',
      'arcane+lightning': 'galdr',
      'fire+shadow': 'Hel',
      'fire+physical': 'iron',
      'cold+physical': 'ice',
      'lightning+physical': 'thunder',
      'arcane+healing': 'mending',
      'healing+physical': 'blessing',
    },
  },
  retired: {
    spells: {
      heal_minor: 'heal_spell',
      heal_medium: 'heal_spell',
      teleport: 'phase_door',
      // Scroll-only now: a hero who knew it lets it go.
      identify: null,
      // The fused spells of the old altar: each is its base spell, forged with the other element.
      steam_lance: { spellId: 'cold_ray', addedElement: 'fire' },
      surtr_brand: { spellId: 'lightning_bolt', addedElement: 'fire' },
      hagalaz_hail: { spellId: 'cold_ray', addedElement: 'lightning' },
      rune_flare: { spellId: 'fireball', addedElement: 'arcane' },
      rime_shard: { spellId: 'cold_ray', addedElement: 'arcane' },
      galdr_spark: { spellId: 'lightning_bolt', addedElement: 'arcane' },
      hel_fire: { spellId: 'firebolt', addedElement: 'shadow' },
      forge_bolt: { spellId: 'firebolt', addedElement: 'physical' },
      ice_spear: { spellId: 'cold_ray', addedElement: 'physical' },
      thunder_maul: { spellId: 'lightning_bolt', addedElement: 'physical' },
      renewal: { spellId: 'heal_spell', addedElement: 'arcane' },
      iron_blessing: { spellId: 'heal_spell', addedElement: 'physical' },
    },
    // Each old glyph comes back as the Essence-Rune of the element it was made from.
    glyphRunes: {
      kenaz: COTW_ESSENCE_BY_ELEMENT.fire,
      isa: COTW_ESSENCE_BY_ELEMENT.cold,
      thurisaz: COTW_ESSENCE_BY_ELEMENT.lightning,
      ansuz: COTW_ESSENCE_BY_ELEMENT.arcane,
      uruz: COTW_ESSENCE_BY_ELEMENT.physical,
      nauthiz: COTW_ESSENCE_BY_ELEMENT.shadow,
      berkano: COTW_ESSENCE_BY_ELEMENT.healing,
      raido: COTW_ESSENCE_BY_ELEMENT.arcane,
      binding: COTW_ESSENCE_BY_ELEMENT.arcane,
    },
  },
};
