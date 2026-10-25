import type { GrimoireSystemConfig } from '../engine';

/**
 * The hero-creation row that picks the stat growing the first grimoire's first axis. It shows
 * only for a pack with the three-grimoire model, the power stat preselected so "Create & Embark"
 * works unchanged. Returns the select when the row shows.
 */
export function fillFirstStatRow(
  row: HTMLElement,
  select: HTMLSelectElement,
  config: GrimoireSystemConfig | undefined
): HTMLSelectElement | undefined {
  row.hidden = !config;
  if (!config) return undefined;
  select.innerHTML = '';
  const preselected = config.stats.find((s) => s.kind === 'power') ?? config.stats[0];
  for (const stat of config.stats) {
    const option = document.createElement('option');
    option.value = stat.id;
    option.textContent = stat.name;
    option.title = stat.description;
    option.selected = stat === preselected;
    select.appendChild(option);
  }
  return select;
}
