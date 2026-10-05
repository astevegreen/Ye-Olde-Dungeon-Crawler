import { describe, it, expect } from 'vitest';
import { setCanvasTextScale, setUiTextScale, uiFontPx } from '../theme';

/** Tracker 4.5: canvas text follows the UI scale (N8). */
describe('canvas text follows the UI scale', () => {
  it('uiFont sizes grow by the factor, so the floor never drops under 11 CSS px', () => {
    setCanvasTextScale(1);
    setUiTextScale(1);
    expect(uiFontPx('xs')).toBe(11);
    setUiTextScale(1.5);
    expect(uiFontPx('xs')).toBe(16.5);
    expect(uiFontPx('md')).toBe(19.5);
    setUiTextScale(1);
  });
});
