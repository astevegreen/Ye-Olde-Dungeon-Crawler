import { safeJsonStringify, type GameEngine } from '../../engine';
import { escapeHtml } from '../html';
import type { DiagnosticTabContext } from './types';
import { kvList } from './markup';

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

  const resultTag = lastResult
    ? `<span class="diag-tag ${lastResult.success ? 'is-good' : 'is-bad'}">${lastResult.success ? 'Success' : 'Failed'}</span>`
    : 'N/A';

  const eventList =
    recentEvents.length === 0
      ? `<div class="diag-empty">No domain events in the buffer yet.</div>`
      : `<div class="diag-list is-scroll">${[...recentEvents]
          .reverse()
          .map((ev) => `<div class="diag-item"><span class="diag-tag is-info">${escapeHtml(ev.type)}</span><span>${escapeHtml(formatEventSummary(ev))}</span></div>`)
          .join('')}</div>`;

  container.innerHTML = `
    <div class="diag-banner ${isLocked ? 'is-bad' : 'is-good'}">
      <div>
        <span class="diag-banner-title">Input pipeline</span>
        <span class="diag-v ${isLocked ? 'is-bad' : 'is-good'}">${isLocked ? 'LOCKED (ACTIVE ANIMATION / RESOLUTION IN PROGRESS)' : 'READY (ACCEPTING INPUTS)'}</span>
      </div>
      ${isLocked ? `<button type="button" id="btn-pipeline-quick-unlock" class="ui-btn ui-btn--sm ui-btn--danger">Force clear lock</button>` : ''}
    </div>
    <div class="diag-grid">
      <div class="ui-card">
        <div class="ui-h">Last action</div>
        ${kvList([
          ['Action', escapeHtml(lastActionName)],
          ['Result', resultTag],
          ['Energy cost', `${lastResult?.cost ?? 0} ticks`],
          ['Message', escapeHtml(lastResult?.message ?? 'No action dispatched yet.')],
          ['Visual effects', `${lastResult?.effects?.length ?? 0}`],
        ])}
      </div>
      <div class="ui-card">
        <div class="ui-h">Chord buffer</div>
        ${kvList([
          ['Arrow chording', chordStatus.enabled ? 'On (8-way)' : 'Off (4-way)'],
          ['Buffer window', `${chordStatus.bufferMs}ms`],
          ['Pressed keys', escapeHtml(chordStatus.pressedKeys.length > 0 ? chordStatus.pressedKeys.join(', ') : 'None')],
          ['Chording', chordStatus.isChording ? 'Yes' : 'No'],
          ['Timer pending', chordStatus.hasPendingTimer ? 'Yes' : 'No'],
        ])}
      </div>
    </div>
    <div class="ui-card">
      <div class="ui-h">Domain events <small>${recentEvents.length} recent</small></div>
      ${eventList}
    </div>`;

  // Hook up quick unlock button if present
  const quickUnlockBtn = container.querySelector('#btn-pipeline-quick-unlock');
  quickUnlockBtn?.addEventListener('click', () => {
    ctx.inputContext?.clearInputLock();
    ctx.showToast('Forced input lock clear. Pipeline responsive.');
    ctx.refresh();
  });
}
