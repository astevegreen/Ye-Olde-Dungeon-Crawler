import { describe, it, expect } from 'vitest';
import { resolveUiScale } from '../uiScale';

/** Tracker 4.5: UI scale with an Auto default (N8). */
describe('resolveUiScale', () => {
  it('Auto is 1 at 1366 × 768 and below, and grows a quarter step with the window, to 2', () => {
    expect(resolveUiScale('auto', 1280, 720)).toBe(1);
    expect(resolveUiScale('auto', 1366, 768)).toBe(1);
    expect(resolveUiScale('auto', 1920, 1080)).toBe(1.25);
    expect(resolveUiScale('auto', 2560, 1440)).toBe(1.75);
    expect(resolveUiScale('auto', 3840, 2160)).toBe(2);
    // The smaller ratio rules: a wide, short window stays small.
    expect(resolveUiScale('auto', 3440, 800)).toBe(1);
  });

  it('a fixed choice holds whatever the window, within 1 to 2', () => {
    expect(resolveUiScale(1.5, 1280, 720)).toBe(1.5);
    expect(resolveUiScale(1, 3840, 2160)).toBe(1);
    expect(resolveUiScale(3, 1920, 1080)).toBe(2);
    expect(resolveUiScale(0.5, 1920, 1080)).toBe(1);
  });
});

