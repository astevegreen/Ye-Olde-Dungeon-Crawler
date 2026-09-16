import type { RunPactDefinition } from '../../engine';

export const COTW_PACTS: RunPactDefinition[] = [
  {
    id: 'pact_blood',
    name: 'Pact of the Blood Moon',
    description: 'Surrender your physical vitality in exchange for ancient treasures.',
    curseDescription: '-25% Maximum Health',
    rewardDescription: '2.0x Gold drops, +20% Magic Find',
    mutators: {
      playerMaxHpPercent: -0.25,
    },
    rewards: {
      goldMultiplier: 2.0,
      magicFindBonus: 0.2,
    },
  },
  {
    id: 'pact_gloom',
    name: 'Pact of Everlasting Gloom',
    description: 'Embrace the impenetrable shadows of Niflheim.',
    curseDescription: '-3 Vision (FOV) Radius',
    rewardDescription: '1.75x Experience Gained',
    mutators: {
      fovRadiusModifier: -3,
    },
    rewards: {
      xpMultiplier: 1.75,
    },
  },
  {
    id: 'pact_swarm',
    name: 'Pact of the Swarm',
    description: 'The dungeon awakens with a frenzy of bloodthirsty denizens.',
    curseDescription: '1.5x Monster Density, -2 Player Defense',
    rewardDescription: '2.5x Gold drops, 1.5x Experience Gained',
    mutators: {
      monsterDensityMultiplier: 1.5,
      playerDefenseBonus: -2,
    },
    rewards: {
      goldMultiplier: 2.5,
      xpMultiplier: 1.5,
    },
  },
  {
    id: 'pact_recklessness',
    name: 'Pact of Recklessness',
    description: 'Abandon all caution and defensive technique for lethal striking power.',
    curseDescription: '-4 Player Defense',
    rewardDescription: '+4 Player Attack, 2.0x Experience Gained',
    mutators: {
      playerDefenseBonus: -4,
      playerAttackBonus: 4,
    },
    rewards: {
      xpMultiplier: 2.0,
    },
  },
];
