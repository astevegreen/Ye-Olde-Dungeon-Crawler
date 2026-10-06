import { describe, it, expect } from 'vitest';
import { messageLogRows } from '../messageLogModal';

describe("the log's history rows", () => {
  it('keeps every line in order, toned as the strip tones it, and escaped', () => {
    const html = messageLogRows(['You enter the cellar.', 'A Rat bites Sven for 2 damage.', '<b>odd</b>'], 'Sven');
    const rows = html.match(/<div class="log-line[^"]*">/g) ?? [];
    expect(rows).toHaveLength(3);
    expect(html.indexOf('cellar')).toBeLessThan(html.indexOf('Rat bites'));
    expect(rows[1]).toContain('log-line-danger');
    expect(html).toContain('&lt;b&gt;odd&lt;/b&gt;');
  });

  it('shows a line repeated in a row once, with its count', () => {
    const hit = 'Brim-Howler attacks Sven for 2 damage.';
    const html = messageLogRows([hit, hit, hit, 'You enter the cellar.'], 'Sven');
    expect(html.match(/<div class="log-line[^"]*">/g)).toHaveLength(2);
    expect(html).toContain(`${hit} (×3)`);
  });

  it('says so when nothing has happened', () => {
    expect(messageLogRows([], 'Sven')).toContain('Nothing has happened yet.');
  });
});
