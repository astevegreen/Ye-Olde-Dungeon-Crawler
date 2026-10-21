import { describe, it, expect } from 'vitest';
import { recentMessagesHtml } from '../recentMessages';

/** The strip's rows, in order, as `{ cls, text }`. */
function rows(html: string): { cls: string; text: string }[] {
  return [...html.matchAll(/<div class="(log-line[^"]*)">([^<]*)<\/div>/g)].map((m) => ({ cls: m[1], text: m[2] }));
}

describe('recentMessagesHtml: repeats collapse before the strip takes its last lines', () => {
  it('a run of three counts as one row, so the line before it still shows', () => {
    const html = recentMessagesHtml({ messages: ['A', 'B', 'X', 'X', 'X'], playerName: 'Sven', count: 2 });
    expect(rows(html).map((r) => r.text)).toEqual(['B', 'X (×3)']);
  });

  it('count counts shown rows, not raw lines', () => {
    const html = recentMessagesHtml({ messages: ['A', 'B', 'C', 'D', 'E', 'E', 'E'], playerName: 'Sven', count: 4 });
    expect(rows(html).map((r) => r.text)).toEqual(['B', 'C', 'D', 'E (×3)']);
  });

  it('collapses whatever the log holds, even a run the engine cap has cut', () => {
    // The engine keeps 150 lines; a run that started before the cap shows only the copies still held.
    const html = recentMessagesHtml({ messages: ['X', 'X', 'Y'], playerName: 'Sven', count: 2 });
    expect(rows(html).map((r) => r.text)).toEqual(['X (×2)', 'Y']);
  });

  it('keeps tone and critical-hit marking on collapsed rows', () => {
    const crit = 'Sven attacks the Wolf for 9 damage.';
    const html = recentMessagesHtml({
      messages: ['You enter the cellar.', crit, crit, 'A Wolf bites Sven for 1 damage.'],
      playerName: 'Sven',
      critical: new Set([crit]),
      count: 2,
    });
    const shown = rows(html);
    expect(shown.map((r) => r.text)).toEqual([`${crit} (×2)`, 'A Wolf bites Sven for 1 damage.']);
    expect(shown[0].cls).toBe('log-line log-line-crit');
    expect(shown[1].cls).toBe('log-line log-line-danger');
  });

  it('still says so when nothing has happened', () => {
    expect(recentMessagesHtml({ messages: [], playerName: 'Sven' })).toContain('Nothing has happened yet.');
  });
});
