import type { GameEngine } from '../../engine';
import type { DiagnosticTabContext } from './types';

export function renderActorTab(ctx: DiagnosticTabContext, engine: GameEngine): void {
  const container = ctx.container;
  const p = engine.player;
  if (!p) {
    container.innerHTML = `<div style="padding: 10px; color: #f87171;">No player entity active.</div>`;
    return;
  }

  const hpPct = Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100)));
  const hpColor = hpPct > 50 ? '#4ade80' : hpPct > 20 ? '#facc15' : '#f87171';

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

  container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #090d16; color: #e2e8f0; border: 2px inset #ffffff; flex: 1;">
        
        <!-- Player Header Banner -->
        <div style="background: #1e293b; padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid #4ade80;">
          <div>
            <span style="font-size: 13px; font-weight: bold; color: #f8fafc;">${p.name}</span>
            <span style="color: #94a3b8; margin-left: 6px;">Level ${p.level} (${p.gender ?? 'Hero'})</span>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${p.isInvulnerable ? `<span style="background: #7c3aed; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">🛡️ GOD MODE ACTIVE</span>` : ''}
            ${p.unspentStatPoints > 0 ? `<span style="background: #d97706; color: white; padding: 2px 6px; border-radius: 3px; font-weight: bold;">⭐ ${p.unspentStatPoints} UNSPENT</span>` : ''}
            <span style="color: #cbd5e1;">XP: <strong>${p.xp} / ${p.xpToNextLevel}</strong></span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
          
          <!-- Core Combat Stats -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              ❤️ Health, Mana &amp; Energy
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="color: #94a3b8; width: 110px;">Health (HP):</td>
                <td>
                  <strong style="color: ${hpColor};">${p.hp} / ${p.maxHp}</strong> (${hpPct}%)
                </td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Mana (MP):</td>
                <td><strong style="color: #60a5fa;">${p.mana} / ${p.maxMana}</strong> (${manaPct}%)</td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Attack:</td>
                <td>Base: <strong>${p.baseAttackValue}</strong> | Effective: <strong style="color: #f87171;">${p.attack}</strong></td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Defense:</td>
                <td>Base: <strong>${p.baseDefenseValue}</strong> | Effective: <strong style="color: #60a5fa;">${p.defense}</strong></td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Speed / Energy:</td>
                <td>Speed: <strong>${p.speed}</strong> | Energy: <strong>${p.energy}</strong></td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Encumbrance:</td>
                <td><strong>${weightLbs} lbs</strong> (Tier: <strong>${String(encumbrance ?? 'Unencumbered')}</strong>)</td>
              </tr>
            </table>
          </div>

          <!-- Base Attributes -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              📊 Base Attributes &amp; Afflictions
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px;">
              <tr>
                <td style="color: #94a3b8;">Strength (STR): <strong>${p.strength}</strong></td>
                <td style="color: #94a3b8;">Dexterity (DEX): <strong>${p.dexterity}</strong></td>
              </tr>
              <tr>
                <td style="color: #94a3b8;">Constitution (CON): <strong>${p.constitution}</strong></td>
                <td style="color: #94a3b8;">Intelligence (INT): <strong>${p.intelligence}</strong></td>
              </tr>
            </table>

            <div style="font-weight: bold; color: #cbd5e1; margin-top: 6px; margin-bottom: 4px;">Active Status Effects:</div>
            ${
              statusEffects.length === 0
                ? `<div style="color: #64748b; font-style: italic;">No active status afflictions.</div>`
                : `<div style="display: flex; flex-direction: column; gap: 3px;">
                    ${statusEffects
                      .map(
                        (se) => `
                      <div style="background: #1e293b; padding: 2px 6px; border-radius: 2px; display: flex; justify-content: space-between;">
                        <span style="color: #fb923c; font-weight: bold;">${se.type}</span>
                        <span style="color: #94a3b8;">${se.duration} ticks left</span>
                      </div>
                    `
                      )
                      .join('')}
                  </div>`
            }
          </div>

        </div>

        <!-- Equipped Gear & Modifiers -->
        <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
            ⚔️ Equipped Gear &amp; Item Modifiers (${equippedItems.length} slots)
          </div>
          ${
            equippedItems.length === 0
              ? `<div style="color: #64748b; font-style: italic;">No items currently equipped.</div>`
              : `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 6px;">
                  ${equippedItems
                    .map(({ slot, item }) => {
                      const mods = item.modifiers ?? [];
                      const isCursed = item.isCursed?.() ?? false;
                      return `
                      <div style="background: #1e293b; padding: 6px; border-radius: 3px; border-left: 3px solid ${isCursed ? '#ef4444' : mods.length > 0 ? '#38bdf8' : '#94a3b8'};">
                        <div style="display: flex; justify-content: space-between;">
                          <span style="color: #94a3b8; font-size: 10px;">[${slot}]</span>
                          <strong style="color: ${isCursed ? '#f87171' : '#f1f5f9'};">${item.displayName}</strong>
                        </div>
                        ${
                          mods.length > 0
                            ? `<div style="margin-top: 3px; font-size: 10px; color: #a5b4fc;">
                                Modifiers: ${mods.map((m: any) => `${m.name} (${m.category})`).join(', ')}
                              </div>`
                            : ''
                        }
                      </div>
                    `;
                    })
                    .join('')}
                </div>`
          }
        </div>

        <!-- Nearby Entities Inspector -->
        <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
            🎯 Nearby Visible Entities (≤ 4 tiles)
          </div>
          ${
            nearby.length === 0
              ? `<div style="color: #64748b; font-style: italic;">No hostile or neutral entities adjacent to player.</div>`
              : `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px;">
                  ${nearby
                    .map((ent: any) => {
                      const dist = Math.max(Math.abs(ent.x - p.x), Math.abs(ent.y - p.y));
                      return `
                      <div style="background: #1e293b; padding: 6px; border-radius: 3px;">
                        <div style="display: flex; justify-content: space-between;">
                          <strong style="color: #f87171;">${ent.name}</strong>
                          <span style="color: #94a3b8;">dist: ${dist}</span>
                        </div>
                        <div style="font-size: 10px; color: #cbd5e1; margin-top: 2px;">
                          HP: <strong>${ent.hp}/${ent.maxHp}</strong> | AI: <span style="color: #facc15;">${ent.aiState ?? 'idle'}</span>
                        </div>
                      </div>
                    `;
                    })
                    .join('')}
                </div>`
          }
        </div>

      </div>
    `;
}
