import type { AffinityMatrixConfig } from '../../engine';

export const COTW_AFFINITY_MATRIX: AffinityMatrixConfig = {
  elements: [
    { id: 'physical', name: 'Physical' },
    // Each color is the element's body tone in the spell art (`FALL[...].mid`, fx/pen.ts), so
    // the aim line, the blast zone, the damage numbers and the belt slot match the spell itself.
    { id: 'fire', name: 'Fire', oppositeElementId: 'cold', color: '#ff8a2c' },
    { id: 'cold', name: 'Cold', oppositeElementId: 'fire', color: '#9fe6ff' },
    { id: 'lightning', name: 'Lightning', oppositeElementId: 'poison', canReflect: true, color: '#fff27a' },
    { id: 'poison', name: 'Poison', oppositeElementId: 'lightning', groundHazard: true, color: '#95dc4c' },
    { id: 'arcane', name: 'Arcane', color: '#a855f7' },
    { id: 'healing', name: 'Healing', color: '#4ade80' },
    // Blood magic, the Nauthiz glyph and Hel-fire deal it; a few undead and fiends resist it.
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
