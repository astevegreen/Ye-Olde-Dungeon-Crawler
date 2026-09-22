import { safeJsonStringify, type GameEngine } from '../../engine';
import type { DiagnosticTabContext } from './types';

function formatEventSummary(ev: any): string {
  if (ev.type === 'PlayerLeveledUp') {
    return `Hero reached level ${ev.newLevel}! (+${ev.statPointsGained} stat points)`;
  }
  if (ev.type === 'AlignmentRenown') {
    return `Alignment renown updated: ${ev.alignment} -> ${ev.newTotal} (${ev.delta > 0 ? `+${ev.delta}` : ev.delta})`;
  }
  if (ev.type === 'ChaoticProc') {
    return `Chaotic proc '${ev.procType}' triggered by ${ev.actor.name} (${ev.item.displayName})`;
  }
  if (ev.type === 'Uncurse') {
    return `Purification cleansed ${ev.cleansedCount} negative modifiers from ${ev.targetSlot ?? 'inventory'}`;
  }
  return safeJsonStringify(ev);
}

export function renderPipelineTab(ctx: DiagnosticTabContext, engine: GameEngine): void {
  const container = ctx.container;
  const isLocked = ctx.inputContext?.getInputLocked() ?? false;
  const chordStatus = ctx.inputContext?.getChordStatus?.() ?? {
    enabled: false,
    bufferMs: 40,
    pressedKeys: [],
    isChording: false,
    hasPendingTimer: false,
  };

  const lastActionName = engine.lastActionName ?? 'None';
  const lastResult = engine.lastActionResult;
  const recentEvents = engine.recentGameEvents ?? [];

  container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #090d16; color: #e2e8f0; border: 2px inset #ffffff; flex: 1;">
        
        <!-- Pipeline Lock Alert Header -->
        <div style="background: ${isLocked ? '#7f1d1d' : '#064e3b'}; padding: 8px 12px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid ${isLocked ? '#ef4444' : '#10b981'};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 16px;">${isLocked ? '⚠️' : '✅'}</span>
            <div>
              <strong style="color: white; font-size: 12px;">INPUT PIPELINE STATUS:</strong>
              <span style="color: ${isLocked ? '#fca5a5' : '#6ee7b7'}; margin-left: 6px; font-weight: bold;">
                ${isLocked ? 'LOCKED (ACTIVE ANIMATION / RESOLUTION IN PROGRESS)' : 'READY (ACCEPTING INPUTS)'}
              </span>
            </div>
          </div>
          ${
            isLocked
              ? `<button id="btn-pipeline-quick-unlock" class="win-btn primary-btn" style="font-weight: bold; font-size: 10px; padding: 3px 8px;">Force Clear Lock</button>`
              : ''
          }
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
          
          <!-- Last Action Dispatch Result -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              ⚡ Last Dispatched ActionResult
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 120px;">Action Type:</td><td><strong>${lastActionName}</strong></td></tr>
              <tr>
                <td style="color: #94a3b8;">Result Status:</td>
                <td>
                  ${
                    lastResult
                      ? `<span style="background: ${lastResult.success ? '#15803d' : '#dc2626'}; color: white; padding: 1px 6px; border-radius: 2px; font-weight: bold;">
                          ${lastResult.success ? 'SUCCESS' : 'FAILED'}
                        </span>`
                      : 'N/A'
                  }
                </td>
              </tr>
              <tr><td style="color: #94a3b8;">Energy Cost:</td><td><strong>${lastResult?.cost ?? 0} ticks</strong></td></tr>
              <tr><td style="color: #94a3b8;">Message:</td><td style="color: #f1f5f9;">${lastResult?.message ?? 'No action dispatched yet.'}</td></tr>
              <tr><td style="color: #94a3b8;">Visual Effects:</td><td><strong>${lastResult?.effects?.length ?? 0} descriptors</strong></td></tr>
            </table>
          </div>

          <!-- Chord Buffer Micro-Debounce -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              🎹 Chord Buffer Micro-Debounce Status
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="color: #94a3b8; width: 130px;">Arrow Chording:</td><td><strong>${chordStatus.enabled ? 'Enabled (8-Way)' : 'Disabled (4-Way)'}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Buffer Window:</td><td><strong>${chordStatus.bufferMs}ms</strong></td></tr>
              <tr><td style="color: #94a3b8;">Pressed Keys:</td><td><code>${chordStatus.pressedKeys.length > 0 ? chordStatus.pressedKeys.join(', ') : 'None'}</code></td></tr>
              <tr><td style="color: #94a3b8;">Chording Active:</td><td><strong>${chordStatus.isChording ? 'YES' : 'NO'}</strong></td></tr>
              <tr><td style="color: #94a3b8;">Timer Pending:</td><td><strong>${chordStatus.hasPendingTimer ? 'YES' : 'NO'}</strong></td></tr>
            </table>
          </div>

        </div>

        <!-- Recent Domain Events Stream -->
        <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px; flex: 1;">
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
            📜 Domain Event Stream (${recentEvents.length} recent events)
          </div>
          ${
            recentEvents.length === 0
              ? `<div style="color: #64748b; font-style: italic;">No domain events captured in buffer yet.</div>`
              : `<div style="display: flex; flex-direction: column; gap: 4px; max-height: 180px; overflow-y: auto;">
                  ${[...recentEvents]
                    .reverse()
                    .map((ev) => {
                      return `
                      <div style="background: #1e293b; padding: 4px 8px; border-radius: 3px; display: flex; gap: 8px; align-items: center;">
                        <span style="background: #0284c7; color: white; padding: 1px 4px; border-radius: 2px; font-size: 10px; font-weight: bold;">${ev.type}</span>
                        <span style="color: #f8fafc; font-size: 11px;">${formatEventSummary(ev)}</span>
                      </div>
                    `;
                    })
                    .join('')}
                </div>`
          }
        </div>

      </div>
    `;

  // Hook up quick unlock button if present
  const quickUnlockBtn = container.querySelector('#btn-pipeline-quick-unlock');
  quickUnlockBtn?.addEventListener('click', () => {
    ctx.inputContext?.clearInputLock();
    ctx.showToast('Forced input lock clear. Pipeline responsive.');
    ctx.refresh();
  });
}
