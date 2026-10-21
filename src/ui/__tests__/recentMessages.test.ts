import { describe, it, expect } from 'vitest';
import { recentMessagesHtml } from '../recentMessages';
import { messageLogRows } from '../messageLogModal';
import { collapseByAction, runText } from '../logClassifier';

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

// The HUD strip (`collapseByAction` in main.ts), the history and this strip read one log the same way.
describe('every view of the log folds one action\'s repeats alike', () => {
  const log = ['You enter the den.', 'W attacks', 'W waits', 'W attacks', 'W waits', 'W attacks', 'You enter the den.'];
  const groups = [undefined, 0, 0, 0, 0, 0, 1];
  const expected = ['You enter the den.', 'W attacks (×3)', 'W waits (×2)', 'You enter the den.'];

  it('the HUD runs, the history rows and the strip rows match', () => {
    const hud = collapseByAction(log, groups).map(({ message, count }) => runText(message, count));
    const history = rows(messageLogRows(log, 'Sven', undefined, undefined, groups)).map((r) => r.text);
    const strip = rows(recentMessagesHtml({ messages: log, groups, playerName: 'Sven', count: 6 })).map((r) => r.text);
    expect(hud).toEqual(expected);
    expect(history).toEqual(expected);
    expect(strip).toEqual(expected);
  });

  it('without groups, every view folds only repeats in a row', () => {
    const strip = rows(recentMessagesHtml({ messages: log, playerName: 'Sven', count: log.length })).map((r) => r.text);
    expect(strip).toEqual(log);
  });
});
