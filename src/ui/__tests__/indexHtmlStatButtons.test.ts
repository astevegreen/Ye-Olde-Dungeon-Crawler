import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** The hero-creation − and + buttons: a screen reader names the stat, not just "-" or "+". */
describe('index.html hero-creation stat buttons', () => {
  const html = readFileSync('index.html', 'utf8');

  const cases = ['str', 'int', 'con', 'dex'].flatMap((stat) => [
    { id: `btn-dec-${stat}`, label: `Lower ${stat.toUpperCase()}`, text: '-' },
    { id: `btn-inc-${stat}`, label: `Raise ${stat.toUpperCase()}`, text: '+' },
  ]);

  it.each(cases)('#$id is announced and titled "$label", and still shows "$text"', ({ id, label, text }) => {
    const button = new RegExp(`<button\\b([^>]*\\bid="${id}"[^>]*)>([^<]*)</button>`).exec(html);
    expect(button, `#${id} exists`).not.toBeNull();
    const [, attrs, shown] = button ?? [];
    expect(attrs).toMatch(new RegExp(`\\baria-label="${label}"`));
    expect(attrs).toMatch(new RegExp(`\\btitle="${label}"`));
    expect(shown).toBe(text);
  });
});
