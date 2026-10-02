import { formatCurrency, type HallOfFameEntry } from '../engine';
import { escapeHtml } from './html';

/**
 * A finished run's record as facts: the end-of-run screen, the hall of fame and the saga
 * exchange show it as a list, and "Copy epitaph" copies the same facts as plain lines.
 */
export function epitaphFacts(entry: HallOfFameEntry, xpName: string): Array<[string, string]> {
  const date = new Date(entry.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  return [
    ['Hero', entry.heroName],
    ['Level', String(entry.level)],
    ['Fate', entry.epitaph],
    ['Deepest', `Floor ${entry.deepestFloor}`],
    ['Turns', entry.turns.toLocaleString('en-US')],
    [xpName, entry.xp.toLocaleString('en-US')],
    ['Wealth', formatCurrency(entry.goldCp)],
    ['Score', `${entry.score.toLocaleString('en-US')} points`],
    ['Date', date],
  ];
}

export function epitaphHtml(entry: HallOfFameEntry, xpName: string): string {
  const rows = epitaphFacts(entry, xpName)
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join('');
  return `<dl class="ui-kv ui-epitaph-facts">${rows}</dl>`;
}

export function epitaphText(entry: HallOfFameEntry, xpName: string): string {
  return epitaphFacts(entry, xpName)
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');
}
