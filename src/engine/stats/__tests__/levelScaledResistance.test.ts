import { describe, it, expect } from 'vitest';
import {
  resolveLevelScaledResistance,
  applyLevelScaledElementalMitigation,
  type LevelResistanceCurve,
} from '../levelScaledResistance';

describe('resolveLevelScaledResistance', () => {
  it('returns 0 (neutral) with no curve', () => {
    expect(resolveLevelScaledResistance(undefined, 10)).toBe(0);
    expect(resolveLevelScaledResistance([], 10)).toBe(0);
  });

  it('returns 0 below the first threshold', () => {
    const curve: LevelResistanceCurve = [{ level: 5, resistance: 0.5 }];
    expect(resolveLevelScaledResistance(curve, 1)).toBe(0);
    expect(resolveLevelScaledResistance(curve, 4)).toBe(0);
  });

  it('applies the highest threshold at or below the current level (a step curve)', () => {
    const curve: LevelResistanceCurve = [
      { level: 1, resistance: 0.5 },
      { level: 10, resistance: 0.65 },
      { level: 20, resistance: 0.75 },
    ];
    expect(resolveLevelScaledResistance(curve, 1)).toBe(0.5);
    expect(resolveLevelScaledResistance(curve, 9)).toBe(0.5);
    expect(resolveLevelScaledResistance(curve, 10)).toBe(0.65);
    expect(resolveLevelScaledResistance(curve, 19)).toBe(0.65);
    expect(resolveLevelScaledResistance(curve, 20)).toBe(0.75);
    expect(resolveLevelScaledResistance(curve, 99)).toBe(0.75);
  });

  it('supports a worsening (negative) curve — growing vulnerability with depth/level', () => {
    const curve: LevelResistanceCurve = [
      { level: 1, resistance: -0.1 },
      { level: 15, resistance: -0.3 },
      { level: 25, resistance: -0.5 },
    ];
    expect(resolveLevelScaledResistance(curve, 1)).toBe(-0.1);
    expect(resolveLevelScaledResistance(curve, 15)).toBe(-0.3);
    expect(resolveLevelScaledResistance(curve, 25)).toBe(-0.5);
  });

  it('clamps to [-1, 1] even if a curve declares outside that range', () => {
    const curve: LevelResistanceCurve = [{ level: 1, resistance: 5 }];
    expect(resolveLevelScaledResistance(curve, 1)).toBe(1);
    const negCurve: LevelResistanceCurve = [{ level: 1, resistance: -5 }];
    expect(resolveLevelScaledResistance(negCurve, 1)).toBe(-1);
  });
});

describe('applyLevelScaledElementalMitigation', () => {
  it('reduces damage by the resistance fraction, rounding to the nearest integer', () => {
    const curve: LevelResistanceCurve = [{ level: 1, resistance: 0.5 }];
    expect(applyLevelScaledElementalMitigation(100, 1, curve)).toBe(50);
    expect(applyLevelScaledElementalMitigation(11, 1, curve)).toBe(6); // 5.5 -> 6
  });

  it('amplifies damage for a negative (vulnerable) resistance', () => {
    const curve: LevelResistanceCurve = [{ level: 1, resistance: -0.5 }];
    expect(applyLevelScaledElementalMitigation(100, 1, curve)).toBe(150);
  });

  it('never goes below 0 damage', () => {
    const curve: LevelResistanceCurve = [{ level: 1, resistance: 1 }];
    expect(applyLevelScaledElementalMitigation(100, 1, curve)).toBe(0);
  });

  it('passes damage through unchanged with no curve', () => {
    expect(applyLevelScaledElementalMitigation(42, 5, undefined)).toBe(42);
  });
});
