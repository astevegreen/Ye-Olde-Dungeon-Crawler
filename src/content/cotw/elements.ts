import type { AffinityMatrixConfig } from '../../engine';

export const COTW_AFFINITY_MATRIX: AffinityMatrixConfig = {
  elements: [
    { id: 'physical', name: 'Physical' },
    { id: 'fire', name: 'Fire', oppositeElementId: 'cold', color: '#ef4444' },
    { id: 'cold', name: 'Cold', oppositeElementId: 'fire', color: '#38bdf8' },
    { id: 'lightning', name: 'Lightning', oppositeElementId: 'poison', canReflect: true, color: '#eab308' },
    { id: 'poison', name: 'Poison', oppositeElementId: 'lightning', groundHazard: true, color: '#22c55e' },
    { id: 'arcane', name: 'Arcane', color: '#a855f7' },
    { id: 'healing', name: 'Healing', color: '#4ade80' },
    // Blood magic, the Nauthiz glyph and Hel-Fire deal it; a few undead and fiends resist it.
    // No color: each shadow spell keeps its own. Wildfire never turns a spell to shadow.
    { id: 'shadow', name: 'Shadow', excludeFromRandom: true },
  ],
  defaultMultipliers: {
    weak: 1.5,
    neutral: 1.0,
    resistant: 0.5,
    immune: 0.0,
    absorbing: -1.0,
  },
};
