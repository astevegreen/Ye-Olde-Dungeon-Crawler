import { describe, it, expect } from 'vitest';
import type { HallOfFameEntry } from '../../engine';
import { epitaphFacts, epitaphHtml, epitaphText } from '../epitaph';

const freya: HallOfFameEntry = {
  id: 'hero-export',
  heroName: 'Freya <the Bold>',
  gender: 'female',
  status: 'victorious',
  epitaph: 'Drove the wyrm from the root.',
  level: 4,
  deepestFloor: 50,
  turns: 6420,
  xp: 3200,
  goldCp: 18_450,
  score: 10_792,
  date: Date.UTC(2026, 9, 2, 12),
};

describe('epitaph', () => {
  it("states a run's record as facts, in the one money format, with the pack's word for experience", () => {
    expect(Object.fromEntries(epitaphFacts(freya, 'Megin'))).toMatchObject({
      Hero: 'Freya <the Bold>',
      Level: '4',
      Fate: 'Drove the wyrm from the root.',
      Deepest: 'Floor 50',
      Turns: '6,420',
      Megin: '3,200',
      Score: '10,792 points',
      Date: 'Oct 2, 2026',
    });
    expect(Object.fromEntries(epitaphFacts(freya, 'XP')).Wealth).toMatch(/CP$/);
  });

  it('escapes the list, and copies as plain lines with no box drawing', () => {
    expect(epitaphHtml(freya, 'XP')).toContain('<dt>Hero</dt><dd>Freya &lt;the Bold&gt;</dd>');
    const text = epitaphText(freya, 'XP');
    expect(text.split('\n')[0]).toBe('Hero: Freya <the Bold>');
    expect(text).not.toMatch(/[╔║═]/);
  });

  it('leaves the score out for a screen that shows it on its own', () => {
    expect(epitaphHtml(freya, 'XP')).toContain('<dt>Score</dt>');
    const html = epitaphHtml(freya, 'XP', { withScore: false });
    expect(html).not.toContain('<dt>Score</dt>');
    expect(html).toContain('<dt>Wealth</dt>');
  });
});
