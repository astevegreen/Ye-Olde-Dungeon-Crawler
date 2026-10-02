import { Monster, type GameEngine } from '../../engine';
import { escapeHtml } from '../html';
import type { DiagnosticTabContext } from './types';
import { kvList } from './markup';

export function renderActorTab(ctx: DiagnosticTabContext, engine: GameEngine): void {
  const container = ctx.container;
  const p = engine.player;
  if (!p) {
    container.innerHTML = `<div class="diag-empty">No hero in play.</div>`;
    return;
  }

  const hpPct = Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100)));
  const hpTone = hpPct > 50 ? 'is-good' : hpPct > 20 ? 'is-warn' : 'is-bad';

  const manaPct = Math.max(0, Math.min(100, Math.round((p.mana / Math.max(1, p.maxMana)) * 100)));

  const statusEffects = p.statusManager.getAll();
  const equippedItems = p.inventory?.paperdoll.getAllEquipped() ?? [];
  const encumbrance = p.inventory?.getEncumbrance(p.strength);
  const weightLbs = p.inventory ? (p.inventory.totalWeight() / 453.592).toFixed(1) : '0';

  // Find nearby entities within distance <= 4
  const map = engine.map;
  const nearby = map.getAllEntities().filter((e) => {
    if (e.id === p.id || !e.isAlive()) return false;
    const dx = Math.abs(e.x - p.x);
    const dy = Math.abs(e.y - p.y);
    return Math.max(dx, dy) <= 4;
  });

  const statusList =
    statusEffects.length === 0
      ? `<div class="diag-empty">No conditions.</div>`
      : `<div class="diag-list">${statusEffects
          .map((se) => `<div class="diag-item"><span class="diag-v is-warn">${escapeHtml(se.type)}</span><span class="ui-muted">${se.duration} ticks left</span></div>`)
          .join('')}</div>`;

  const gearList =
    equippedItems.length === 0
      ? `<div class="diag-empty">Nothing equipped.</div>`
      : `<div class="diag-list is-grid">${equippedItems
          .map(({ slot, item }) => {
            const mods = item.modifiers ?? [];
            const isCursed = item.isCursed?.() ?? false;
            const tone = isCursed ? ' is-bad' : mods.length > 0 ? ' is-info' : '';
            const modLine =
              mods.length > 0
                ? `<div class="diag-v is-info">Modifiers: ${escapeHtml(mods.map((m) => `${m.name} (${m.category})`).join(', '))}</div>`
                : '';
            return `<div class="diag-item is-stack${tone}">
              <div class="diag-item-line"><span class="ui-muted">${escapeHtml(slot)}</span><b class="${isCursed ? 'diag-v is-bad' : ''}">${escapeHtml(item.displayName)}</b></div>
              ${modLine}
            </div>`;
          })
          .join('')}</div>`;

  const nearbyList =
    nearby.length === 0
      ? `<div class="diag-empty">Nothing within 4 tiles.</div>`
      : `<div class="diag-list is-grid">${nearby
          .map((ent) => {
            const dist = Math.max(Math.abs(ent.x - p.x), Math.abs(ent.y - p.y));
            const ai = ent instanceof Monster ? ent.aiState : 'idle';
            return `<div class="diag-item is-stack">
              <div class="diag-item-line"><b class="diag-v is-bad">${escapeHtml(ent.name)}</b><span class="ui-muted">dist ${dist}</span></div>
              <div>HP ${ent.hp}/${ent.maxHp} · AI <span class="diag-v is-warn">${escapeHtml(ai ?? 'idle')}</span></div>
            </div>`;
          })
          .join('')}</div>`;

  container.innerHTML = `
    <div class="diag-banner is-good">
      <div><span class="diag-banner-title">${escapeHtml(p.name)}</span> <span class="ui-muted">Level ${p.level}${p.gender ? ` · ${escapeHtml(p.gender)}` : ''}</span></div>
      <div class="diag-row-wrap">
        ${p.isInvulnerable ? `<span class="diag-tag is-accent">God mode</span>` : ''}
        ${p.unspentStatPoints > 0 ? `<span class="diag-tag is-warn">${p.unspentStatPoints} unspent</span>` : ''}
        <span class="ui-muted">XP <b>${p.xp} / ${p.xpToNextLevel}</b></span>
      </div>
    </div>
    <div class="diag-grid">
      <div class="ui-card">
        <div class="ui-h">Vitals and combat</div>
        ${kvList([
          ['Health', `<span class="diag-v ${hpTone}">${p.hp} / ${p.maxHp}</span> (${hpPct}%)`],
          ['Mana', `<span class="diag-v is-mana">${p.mana} / ${p.maxMana}</span> (${manaPct}%)`],
          ['Attack', `base ${p.baseAttackValue} · effective <b>${p.attack}</b>`],
          ['Defense', `base ${p.baseDefenseValue} · effective <b>${p.defense}</b>`],
          ['Speed / energy', `${p.speed} / ${p.energy}`],
          ['Encumbrance', `${weightLbs} lbs (${escapeHtml(String(encumbrance ?? 'Unencumbered'))})`],
        ])}
      </div>
      <div class="ui-card">
        <div class="ui-h">Attributes and conditions</div>
        ${kvList([
          ['Strength (STR)', `${p.strength}`],
          ['Dexterity (DEX)', `${p.dexterity}`],
          ['Constitution (CON)', `${p.constitution}`],
          ['Intelligence (INT)', `${p.intelligence}`],
        ])}
        <div class="ui-dialog-label diag-label">Conditions</div>
        ${statusList}
      </div>
    </div>
    <div class="ui-card">
      <div class="ui-h">Equipped gear <small>${equippedItems.length} slots</small></div>
      ${gearList}
    </div>
    <div class="ui-card">
      <div class="ui-h">Nearby <small>within 4 tiles</small></div>
      ${nearbyList}
    </div>`;
}
