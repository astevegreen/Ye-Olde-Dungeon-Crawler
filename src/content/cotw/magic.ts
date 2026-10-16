import type { MagicSystemConfig } from '../../engine';
import { COTW_ESSENCE_BY_ELEMENT } from './items/essences';
import { COTW_GRIMOIRES } from './grimoires';
import { COTW_LEARNING_STONES } from './learningStones';

/** Spells Loki's Cairn may teach: every spell kill rites and tablets teach. */
const LOKI_SPELL_POOL = [
  'slow', 'cold_ray', 'firebolt', 'phase_door', 'hlidskjalf', 'loki_switch', 'lightning_bolt',
  'fireball', 'paralyze', 'rime_floor', 'call_the_pack', 'shroud_of_mani', 'rockfall', 'thunderclap',
  'fafnirs_breath',
];

/**
 * cotw's magic systems (engine `MagicSystemConfig`): Ginnungagap overflow, the three
 * grimoires (`grimoires.ts`), Galdr of the Slain rites and the runic altars.
 */
export const COTW_MAGIC: MagicSystemConfig = {
  overflow: {
    debtName: 'Void Debt',
    lingeringDebt: 16,
    lingeringRestMessage:
      'Your primordial void scar (Tier 3 Void Debt) throbs with abyssal energy — it lingers indefinitely until cleansed in Town!',
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
              { gas: 'dense_steam', duration: 4, potency: 1, message: 'Aetheric overflow! A pocket of dense steam billows from the floor! (Void Debt: {debt})' },
              { surface: 'ice_sheet', duration: 5, potency: 1, message: 'Aetheric overflow! Frost condenses into a slick sheet of ice! (Void Debt: {debt})' },
              { gas: 'fire_storm', duration: 3, potency: 4, message: 'Aetheric overflow! A brief fiery rift flares on the stone! (Void Debt: {debt})' },
            ],
            blockedMessage: 'Aetheric overflow ripples harmlessly through the stone! (Void Debt: {debt})',
          },
          { kind: 'message', weight: 40, message: 'Seiðr depleted! An eerie rift crackles around {caster}! (Void Debt: {debt})' },
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
            message: 'Primordial tremor! The uncontained ether recoils into {caster} for {damage} backlash damage! (Void Debt: {debt})',
          },
          {
            kind: 'status',
            weight: 35,
            statusId: 'stunned',
            duration: 1,
            message: 'Primordial tremor! The dimensional shockwave stuns {caster} for 1 turn! (Void Debt: {debt})',
          },
          {
            kind: 'surface_under_caster',
            weight: 20,
            surface: 'acid_pool',
            duration: 4,
            potency: 1,
            message: 'Primordial tremor! Caustic aether pools beneath {caster}! (Void Debt: {debt})',
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
            message: "YMIR'S WRATH! Catastrophic void backlash tears into {caster} for {damage} damage! (Void Debt: {debt})",
          },
          {
            kind: 'max_hp_burn',
            weight: 30,
            amount: 1,
            minMaxHp: 5,
            fallbackDamage: 12,
            message: "YMIR'S WRATH! The abyssal conduit burns away 1 permanent Max HP! (Max HP: {maxHp}, Void Debt: {debt})",
            fallbackMessage: "YMIR'S WRATH! The cosmic conduit ravages {caster} for {damage} damage! (Void Debt: {debt})",
          },
          {
            kind: 'displace',
            weight: 30,
            radius: 4,
            message: "YMIR'S WRATH! A spatial rupture violently displaces {caster}! (Void Debt: {debt})",
            blockedMessage: "YMIR'S WRATH shatters the surrounding reality! (Void Debt: {debt})",
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
    essenceMessage: "Galdr resonance! {monster}'s spirit hardens into rune-stone: {essence}.",
    essenceItems: COTW_ESSENCE_BY_ELEMENT,
    // A full clear met 87–229 rites per element against 12 altars; this leaves about 4–11
    // runes of each. Healing rites are rarer, lightning ones rarest.
    essenceDropChance: 0.1,
    essenceDropChanceByElement: { healing: 0.2, lightning: 1 },
  },
  grimoires: COTW_GRIMOIRES,
  learningStones: COTW_LEARNING_STONES,
  altars: [
    {
      id: 'galdr_altar_tyr',
      name: "Týr's Oath-Stone",
      description:
        'Týr gave his hand to bind the wolf. Burn an offering here, a spell you know or an Essence-Rune, and one grimoire slot you choose lends its neighbours twice as much.',
      rite: 'double',
      performedMessage: 'Týr accepts {offering}. What {spell} lends its neighbours is doubled.',
      spentMessage: '{altar} stands cold; its oath is already sworn.',
    },
    {
      id: 'galdr_altar_odin',
      name: "Odin's Gallows-Stone",
      description:
        'Odin hung nine nights to win the runes. Give up an offering here, a spell you know or an Essence-Rune, and one of your spells takes its element beside its own: it strikes as whichever of the two hurts the foe more, and lends both. Forging a spell again swaps the element it was given.',
      rite: 'forge',
      performedMessage: 'Odin takes {offering}. {spell} is reforged: {title}.',
      spentMessage: '{altar} is silent; the Hanged One has taken his due.',
    },
    {
      id: 'galdr_altar_hel',
      name: "Hel's Grave-Altar",
      description:
        'Hel rules the dead, who change nothing. Here, once, she lets you change one thing: choose afresh the stats of one grimoire. She asks no offering, and takes your Void Debt besides.',
      rite: 'restat',
      free: true,
      clearsVoidDebt: true,
      deeperRites: [
        {
          fromFloor: 31,
          rite: 'addSlot',
          description:
            "Deep in Hel's realm the dead make room for one more. She adds a slot to one grimoire, beside one it has, asks no offering, and takes your Void Debt besides.",
          performedMessage: 'Hel opens a new slot in {grimoire}, and your debts are paid.',
        },
      ],
      performedMessage: 'Hel re-orders the stats of {grimoire}, and your debts are paid.',
      spentMessage: '{altar} is sated.',
    },
    {
      id: 'galdr_altar_loki',
      name: "Loki's Cairn",
      description: 'The trickster takes what you offer, a spell you know or an Essence-Rune, and gives back whatever amuses him: a spell, a doubled lend, or a price.',
      rite: 'gamble',
      performedMessage: 'Loki takes {offering}.',
      spentMessage: '{altar} is only stones now; the trickster has moved on.',
      gamble: {
        previewText: 'Loki decides: a spell, a doubled lend, or a price.',
        spellPool: LOKI_SPELL_POOL,
        debtPenalty: 10,
        spellMessage: 'Loki takes {offering} and laughs, and the galdr of {spell} rings in your head!',
        doubleMessage: 'Loki takes {offering} and scratches a rune beside {spell}: what it lends its neighbours is doubled!',
        debtMessage: 'Loki takes {offering}, and the price is yours: the Void comes to collect. (Void Debt: {debt})',
      },
    },
  ],
};

