import type { MagicSystemConfig } from '../../engine';

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
          { kind: 'message', weight: 40, message: '🌀 Mana depleted! An eerie rift crackles around {caster}! (Void Debt: {debt})' },
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
  grimoire: {
    title: 'Grimoire Spatial Matrix',
    pageNames: ['Page I: Sol', 'Page II: Máni', 'Page III: Yggdrasil'],
    centerSlotLabel: 'Midgard',
    centerCostPerNeighbor: 0.15,
    opposedElementPowerMultiplier: 1.25,
  },
};
