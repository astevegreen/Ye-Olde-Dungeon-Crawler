import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { GrimoireSystemConfig } from '../../engine';
import { fillFirstStatRow } from '../firstStatRow';

/** The `#first-stat-row` element of `index.html`, as written. */
function firstStatRowMarkup(): string {
  const html = readFileSync('index.html', 'utf8');
  const start = html.indexOf('<div id="first-stat-row"');
  expect(start).toBeGreaterThan(-1);
  return html.slice(start, html.indexOf('</div>', start));
}

class FakeOption {
  value = '';
  textContent = '';
  title = '';
  selected = false;
}

function fakeRow() {
  const options: FakeOption[] = [];
  const row = { hidden: true } as HTMLElement;
  const select = {
    innerHTML: 'stale',
    appendChild: (o: FakeOption) => options.push(o),
  } as unknown as HTMLSelectElement;
  vi.stubGlobal('document', { createElement: () => new FakeOption() });
  return { row, select, options };
}

const config = {
  layouts: [],
  stats: [
    { id: 'reach', name: 'Reach', description: 'Spells fly further.', kind: 'range' },
    { id: 'might', name: 'Might', description: 'Spells hit harder.', kind: 'power' },
  ],
} as unknown as GrimoireSystemConfig;

describe('the hero-creation first-stat row', () => {
  it('labels its select as a spell choice and hints what it grows', () => {
    const markup = firstStatRowMarkup();
    expect(markup).toMatch(/<label[^>]*for="first-stat-select"[^>]*>First spell stat<\/label>/);
    expect(markup).toMatch(/<div id="first-stat-row"[^>]*title="Grows the spells of your first grimoire\."/);
    expect(markup).toMatch(/<select id="first-stat-select"/);
  });

  it('stays hidden, and offers no select, for a pack without grimoires', () => {
    const { row, select, options } = fakeRow();
    expect(fillFirstStatRow(row, select, undefined)).toBeUndefined();
    expect(row.hidden).toBe(true);
    expect(options).toHaveLength(0);
  });

  it('shows for a pack with grimoires, each option titled with its own description and power preselected', () => {
    const { row, select, options } = fakeRow();
    expect(fillFirstStatRow(row, select, config)).toBe(select);
    expect(row.hidden).toBe(false);
    expect(select.innerHTML).toBe('');
    expect(options.map((o) => [o.value, o.textContent, o.title, o.selected])).toEqual([
      ['reach', 'Reach', 'Spells fly further.', false],
      ['might', 'Might', 'Spells hit harder.', true],
    ]);
  });
});
