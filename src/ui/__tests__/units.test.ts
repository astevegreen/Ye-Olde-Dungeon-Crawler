import { describe, expect, it } from 'vitest';
import { formatKg, formatLoad, formatWeight } from '../units';

describe('weight units', () => {
  it('shows kilograms, with two decimals only under a kilogram', () => {
    expect(formatWeight(120)).toBe('0.12 kg');
    expect(formatWeight(620)).toBe('0.62 kg');
    expect(formatWeight(8700)).toBe('8.7 kg');
    expect(formatWeight(1600)).toBe('1.6 kg');
  });

  it('drops trailing zeros', () => {
    expect(formatKg(100)).toBe('0.1');
    expect(formatKg(2000)).toBe('2');
    expect(formatKg(0)).toBe('0');
  });

  it('formats a load against its limit with one unit', () => {
    expect(formatLoad(8700, 27500)).toBe('8.7 / 27.5 kg');
  });
});
