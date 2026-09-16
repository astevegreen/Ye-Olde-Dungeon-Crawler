import type { AffinityMatrixConfig } from '../../engine';

export const WARCRAFT_AFFINITY_MATRIX: AffinityMatrixConfig = {
  elements: [
    { id: 'physical', name: 'Physical' },
    { id: 'fire', name: 'Fire', oppositeElementId: 'cold', color: '#ef4444' },
    { id: 'cold', name: 'Cold', oppositeElementId: 'fire', color: '#38bdf8' },
    { id: 'lightning', name: 'Lightning', oppositeElementId: 'poison', canReflect: true, color: '#eab308' },
    { id: 'holy', name: 'Holy', oppositeElementId: 'shadow', color: '#facc15' },
    { id: 'shadow', name: 'Shadow', oppositeElementId: 'holy', color: '#7c3aed' },
    { id: 'arcane', name: 'Arcane', canReflect: true, color: '#a855f7' },
  ],
  defaultMultipliers: {
    weak: 1.5,
    neutral: 1.0,
    resistant: 0.5,
    immune: 0.0,
    absorbing: -1.0,
  },
};
