import { formatCurrency, type GameEngine, type Item } from '../../engine';
import { escapeHtml } from '../html';
import { formatWeight } from '../units';
import { itemToneClass } from './itemTone';
import type { InspectorSource, ItemInspector } from './itemInspector';

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

export interface ItemDetailOptions {
  /** Where the item is, for the inspector's breakdown. */
  source: InspectorSource;
  slotId?: string;
  /** The icon canvas's markup: each screen paints its own. */
  iconHtml: string;
  /** Show "Against your …" for an item not worn (the inventory and the shop both do). */
  compare: boolean;
  /** Show the item's value (the inventory); the shop shows its price instead. */
  showValue: boolean;
}

/**
 * One item's detail, as the inventory and the shop both show it (N20): name and kind, the
 * slots it goes on, its stats, weight and space, how it compares with what is worn, and its
 * description. An unidentified item shows none of its stats or its true description: the
 * inspector's breakdown hides them.
 */
export function itemDetailHtml(engine: GameEngine, item: Item, inspector: ItemInspector, opts: ItemDetailOptions): string {
  const b = inspector.getItemBreakdown(item, opts.source, opts.slotId, engine.player.inventory.paperdoll);
  const kind = [b.tier ? `Tier ${b.tier}` : '', b.category].filter(Boolean).join(' ');
  const stats: Array<[string, number | undefined]> = [
    ['Attack', b.stats.attackBonus],
    ['Defense', b.stats.defenseBonus],
    ['Strength', b.stats.strengthBonus],
    ['Speed', b.stats.speedBonus],
  ];
  const statRows = stats
    .filter(([, v]) => v)
    .map(([k, v]) => `<dt>${k}</dt><dd class="ui-num">${signed(v!)}</dd>`)
    .join('');
  const affix = b.elementalAffix
    ? `<dt>${escapeHtml(b.elementalAffix.name)}</dt><dd class="ui-num">+${b.elementalAffix.bonusDamage} ${escapeHtml(b.elementalAffix.element)}</dd>`
    : '';

  let compare = '';
  if (opts.compare) {
    const cmp = inspector.getEquipmentComparison(item, engine.player);
    if (cmp) {
      const row = (label: string, delta: number, upIsGood = true, fmt: (n: number) => string = signed) =>
        delta === 0 ? '' : `<dt>${label}</dt><dd class="ui-num ${(delta > 0) === upIsGood ? 'ui-up' : 'ui-down'}">${fmt(delta)}</dd>`;
      const rows =
        row('Attack', cmp.attackDelta) +
        row('Defense', cmp.defenseDelta) +
        row('Speed', cmp.speedDelta) +
        row('Strength', cmp.strengthDelta) +
        row('Weight', cmp.weightDelta, false, (n) => `${n > 0 ? '+' : '−'}${formatWeight(Math.abs(n))}`);
      compare = `
        <div class="inv-compare">
          <div class="ui-note">Against your ${escapeHtml(cmp.slotName.toLowerCase())}: <span class="${itemToneClass(cmp.equippedItem).trim()}">${escapeHtml(cmp.equippedItem.displayName)}</span></div>
          ${rows ? `<dl class="ui-kv">${rows}</dl>` : '<div class="ui-note">No difference.</div>'}
        </div>`;
    }
  }

  return `
    <div class="inv-detail-head">
      ${opts.iconHtml}
      <div>
        <div class="inv-detail-name${itemToneClass(item)}">${escapeHtml(b.displayName)}</div>
        <div class="ui-note">${escapeHtml(kind)}${b.isCursed ? ' · <span class="ui-down">cursed</span>' : ''}${b.identified ? '' : ' · unidentified'}</div>
      </div>
    </div>
    ${b.slotCompatibility.length > 0 ? `<div class="ui-note">Goes on: ${escapeHtml(b.slotCompatibility.join(', '))}</div>` : ''}
    ${statRows || affix ? `<dl class="ui-kv">${statRows}${affix}</dl>` : ''}
    <dl class="ui-kv">
      <dt>Weight</dt><dd class="ui-num">${escapeHtml(formatWeight(b.weight))}</dd>
      <dt>Space</dt><dd class="ui-num">${b.bulk} cm³</dd>
      ${opts.showValue && b.value > 0 ? `<dt>Value${b.identified ? '' : ' (guess)'}</dt><dd class="ui-num inv-value">${escapeHtml(formatCurrency(b.value))}</dd>` : ''}
    </dl>
    ${compare}
    <div class="inv-desc">${escapeHtml(b.description)}</div>`;
}
