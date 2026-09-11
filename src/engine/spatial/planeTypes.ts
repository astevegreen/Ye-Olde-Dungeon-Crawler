/**
 * Plane and liminal topology definitions for multi-plane simulation.
 */

export interface DriftVector {
  dx: number;
  dy: number;
  intervalTicks: number;
}

export interface PlaneState {
  id: string;
  name: string;
  isLiminal?: boolean;
  driftVector?: DriftVector;
  attributes?: Record<string, any>;
}

export const DEFAULT_PHYSICAL_PLANE: PlaneState = {
  id: 'physical',
  name: 'Material Plane',
  isLiminal: false,
};

export const DEFAULT_LIMINAL_PLANE: PlaneState = {
  id: 'liminal',
  name: 'Liminal Expanse',
  isLiminal: true,
  driftVector: {
    dx: 1,
    dy: 0,
    intervalTicks: 5,
  },
};
