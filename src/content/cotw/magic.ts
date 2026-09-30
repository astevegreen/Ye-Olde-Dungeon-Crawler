import type { MagicSystemConfig } from '../../engine';
import { COTW_ESSENCE_BY_ELEMENT } from './items/essences';
import { COTW_HYBRID_RECIPES } from './hybridSpells';

/** Spells Loki's Cairn may teach: every spell kill rites and tablets teach. */
const LOKI_SPELL_POOL = [
  'slow', 'cold_ray', 'firebolt', 'phase_door', 'detect_monsters', 'detect_objects', 'lightning_bolt',
  'heal_medium', 'identify', 'teleport', 'fireball', 'paralyze', 'clairvoyance',
];

/**
 * cotw's magic systems (engine `MagicSystemConfig`): Ginnungagap overflow, the
 * grimoire grid, Galdr of the Slain rites and the runic altars.
 */
export const COTW_MAGIC: MagicSystemConfig = {
  overflow: {
    debtName: 'Void Debt',
    lingeringDebt: 16,
    lingeringRestMessage:
      '☠ Your primordial void scar (Tier 3 Void Debt) throbs with abyssal energy — it lingers indefinitely until cleansed in Town!',
    tiers: [
      {
        minDebt: 1,
        label: 'Tier 1 Fracture',
        color: '#c084fc',
        burstRadius: 1,
        burstDurationMs: 200,
        outcomes: [
          {
            kind: 'spill',
            weight: 60,
            spills: [
              { gas: 'dense_steam', duration: 4, potency: 1, message: '🌀 Aetheric overflow! A pocket of dense steam billows from the floor! (Void Debt: {debt})' },
              { surface: 'ice_sheet', duration: 5, potency: 1, message: '🌀 Aetheric overflow! Frost condenses into a slick sheet of ice! (Void Debt: {debt})' },
              { gas: 'fire_storm', duration: 3, potency: 4, message: '🌀 Aetheric overflow! A brief fiery rift flares on the stone! (Void Debt: {debt})' },
            ],
            blockedMessage: '🌀 Aetheric overflow ripples harmlessly through the stone! (Void Debt: {debt})',
          },
          { kind: 'message', weight: 40, message: '🌀 Seiðr depleted! An eerie rift crackles around {caster}! (Void Debt: {debt})' },
        ],
      },
      {
        minDebt: 6,
        label: 'Tier 2 Tremor',
        color: '#a855f7',
        burstRadius: 1,
        burstDurationMs: 200,
        outcomes: [
          {
            kind: 'backlash',
            weight: 45,
            deficitMultiplier: 0.75,
            minDamage: 3,
            flashColor: '#9333ea',
            message: '⚡ Primordial tremor! The uncontained ether recoils into {caster} for {damage} backlash damage! (Void Debt: {debt})',
          },
          {
            kind: 'status',
            weight: 35,
            statusId: 'stunned',
            duration: 1,
            message: '⚡ Primordial tremor! The dimensional shockwave stuns {caster} for 1 turn! (Void Debt: {debt})',
          },
          {
            kind: 'surface_under_caster',
            weight: 20,
            surface: 'acid_pool',
            duration: 4,
            potency: 1,
            message: '⚡ Primordial tremor! Caustic aether pools beneath {caster}! (Void Debt: {debt})',
          },
        ],
      },
      {
        minDebt: 16,
        label: 'Tier 3 Primordial Scar - Lingering',
        color: '#f87171',
        burstRadius: 2,
        burstDurationMs: 300,
        outcomes: [
          {
            kind: 'backlash',
            weight: 40,
            deficitMultiplier: 1.2,
            minDamage: 10,
            flashColor: '#581c87',
            message: "☠ YMIR'S WRATH! Catastrophic void backlash tears into {caster} for {damage} damage! (Void Debt: {debt})",
          },
          {
            kind: 'max_hp_burn',
            weight: 30,
            amount: 1,
            minMaxHp: 5,
            fallbackDamage: 12,
            message: "☠ YMIR'S WRATH! The abyssal conduit burns away 1 permanent Max HP! (Max HP: {maxHp}, Void Debt: {debt})",
            fallbackMessage: "☠ YMIR'S WRATH! The cosmic conduit ravages {caster} for {damage} damage! (Void Debt: {debt})",
          },
          {
            kind: 'displace',
            weight: 30,
            radius: 4,
            message: "☠ YMIR'S WRATH! A spatial rupture violently displaces {caster}! (Void Debt: {debt})",
            blockedMessage: "☠ YMIR'S WRATH shatters the surrounding reality! (Void Debt: {debt})",
          },
        ],
      },
    ],
  },
  killRites: {
    title: 'Galdr of the Slain',
    prophecyLabel: 'Skaldic Prophecy',
    reapedLabel: 'Reaped',
    learnMessage: "*** GALDR OF THE SLAIN! You sever {monster}'s spirit thread and claim {spell}! ***",
    essenceMessage: "✦ Galdr resonance! {monster}'s spirit leaves behind a {essence}. ✦",
    essenceItems: COTW_ESSENCE_BY_ELEMENT,
    killsPerRevealedCondition: 2,
  },
  grimoire: {
    title: 'Grimoire Spatial Matrix',
    pageNames: ['Page I: Sol', 'Page II: Máni', 'Page III: Yggdrasil'],
    centerSlotLabel: 'Midgard',
    centerCostPerNeighbor: 0.15,
    centerPowerPerNeighbor: 0.2,
    opposedElementPowerMultiplier: 1.25,
    // New heroes start with a cross of five slots; Hel's Grave-Altars unseal the corners.
    initialOpenSlots: [1, 3, 4, 5, 7],
    lockedSlotLabel: 'Sealed',
    maxGlyphsPerSlot: 2,
    groundedModifier: { manaCostDelta: -1, powerMultiplier: 1.1 },
    glyphs: [
      { id: 'kenaz', name: 'Kenaz', description: '+20% power', fromElements: ['fire'], modifier: { powerMultiplier: 1.2 } },
      {
        id: 'isa',
        name: 'Isa',
        description: 'damaging spells slow for 2 turns',
        fromElements: ['cold'],
        modifier: { addEffects: [{ type: 'applyStatus', statusId: 'slow', duration: 2 }] },
      },
      {
        id: 'thurisaz',
        name: 'Thurisaz',
        description: 'damage leaps to one more foe',
        fromElements: ['lightning'],
        modifier: { addEffects: [{ type: 'chain', maxHops: 1, hopRange: 3, damageDecay: 0.5 }] },
      },
      { id: 'ansuz', name: 'Ansuz', description: '+2 range', fromElements: ['arcane'], fromSchools: ['Divination'], modifier: { rangeDelta: 2 } },
      { id: 'uruz', name: 'Uruz', description: '+1 blast radius', fromElements: ['physical'], modifier: { areaDelta: 1 } },
      {
        id: 'nauthiz',
        name: 'Nauthiz',
        description: 'damaging spells heal you 3',
        fromElements: ['shadow'],
        modifier: { addEffects: [{ type: 'heal', amount: 3, target: 'caster' }] },
      },
      {
        id: 'berkano',
        name: 'Berkano',
        description: '-2 mana',
        fromElements: ['healing'],
        fromSchools: ['HealingDivination'],
        modifier: { manaCostDelta: -2 },
      },
      {
        id: 'raido',
        name: 'Raidō',
        description: 'step 2 back from your target after casting',
        fromSchools: ['Movement'],
        modifier: { retreatSteps: 2 },
      },
      {
        id: 'binding',
        name: 'Binding',
        description: 'damaging spells paralyze for 1 turn',
        fromSchools: ['Enchantment'],
        modifier: { addEffects: [{ type: 'applyStatus', statusId: 'paralysis', duration: 1 }] },
      },
    ],
  },
  hybrids: COTW_HYBRID_RECIPES,
  altars: [
    {
      id: 'galdr_altar_tyr',
      name: "Týr's Oath-Stone",
      description:
        'Týr gave his hand to bind the wolf. Burn an offering here, and its essence is bound into a slot of your open grimoire page as a glyph.',
      rite: 'inscribe',
      performedMessage: '⚖ Týr accepts {offering}. The {glyph} glyph is bound into slot {slot} of your grimoire.',
      spentMessage: '{altar} stands cold; its oath is already sworn.',
    },
    {
      id: 'galdr_altar_odin',
      name: "Odin's Gallows-Stone",
      description:
        'Odin hung nine nights to win the runes. Give up an offering here to fuse one of your spells with its element, forging a new spell in its place.',
      rite: 'forge',
      performedMessage: '✦ Odin takes {offering}. {spell} is reforged as {hybrid}.',
      spentMessage: '{altar} is silent; the Hanged One has taken his due.',
    },
    {
      id: 'galdr_altar_hel',
      name: "Hel's Grave-Altar",
      description:
        'Hel keeps what is owed. Burn an offering to unseal a corner of your grimoire, grounded in its element (spells of that element cost less and strike harder there), and she takes your Void Debt with it.',
      rite: 'ground',
      performedMessage: '☠ Hel takes {offering}. Slot {slot} of your grimoire opens, grounded in {element}, and your debts are paid.',
      spentMessage: '{altar} is sated.',
    },
    {
      id: 'galdr_altar_loki',
      name: "Loki's Cairn",
      description: 'The trickster takes what you offer and gives back whatever amuses him: a spell, a doubled glyph, or a price.',
      rite: 'gamble',
      performedMessage: '✦ Loki takes {offering}.',
      spentMessage: '{altar} is only stones now; the trickster has moved on.',
      gamble: {
        previewText: 'Loki decides: a spell, a doubled glyph, or a price.',
        spellPool: LOKI_SPELL_POOL,
        debtPenalty: 10,
        spellMessage: '✦ Loki takes {offering} and laughs, and the galdr of {spell} rings in your head!',
        glyphMessage: '✦ Loki takes {offering} and scratches a doubled {glyph} glyph into slot {slot}!',
        debtMessage: '✦ Loki takes {offering}, and the price is yours: the Void comes to collect. (Void Debt: {debt})',
      },
    },
  ],
};

