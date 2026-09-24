import {
  ItemFactory,
  Item,
  WaitAction,
  flightRecorder,
  type GameEngine,
} from '../../engine';
import type { DiagnosticTabContext } from './types';
import { copyTextToClipboard } from '../platform';

function spawnTestItem(ctx: DiagnosticTabContext, engine: GameEngine, type: string | null): void {
  const p = engine.player;
  if (!p) return;

  let item: Item | null = null;
  if (type === 'potion') {
    item = ItemFactory.createHealthPotion(`potion-${Date.now()}`);
  } else if (type === 'blessed') {
    item = new Item({
      id: `blessed-sword-${Date.now()}`,
      name: 'Blessed Longsword',
      unidentifiedName: 'Broadsword',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1600,
      bulk: 1200,
      stats: { attackBonus: 8 },
      identified: true,
      description: 'A holy consecrated steel blade.',
      modifiers: [
        {
          id: `blessed-${Date.now()}`,
          name: 'Blessed',
          category: 'blessed',
          alignment: 'positive',
          meleeDamageMultiplier: 1.25,
          statDeltas: { attackBonus: 4 },
          prefix: 'Blessed',
        },
      ],
    });
  } else if (type === 'cursed') {
    item = ItemFactory.createCursedMace(`cursed-mace-${Date.now()}`);
  } else if (type === 'chaotic') {
    item = new Item({
      id: `chaotic-blade-${Date.now()}`,
      name: 'Chaotic Warpblade',
      unidentifiedName: 'Glowing Sword',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1500,
      bulk: 1200,
      stats: { attackBonus: 12 },
      identified: true,
      description: 'A blade vibrating with chaotic spatial energy.',
      modifiers: [
        {
          id: `chaotic-${Date.now()}`,
          name: 'Chaotic Warp',
          category: 'chaotic',
          alignment: 'chaotic',
          meleeDamageMultiplier: 1.5,
          chaoticProc: {
            type: 'teleport',
            procChance: 0.25,
            param: 3,
            description: 'Randomly teleports wielder on hit',
          },
          prefix: 'Chaotic',
        },
      ],
    });
  }

  if (item) {
    const res = engine.diagnostics.spawnItem(item);
    if (res.placedInPack) {
      ctx.showToast(`Spawned ${item.displayName} in backpack.`);
    } else {
      ctx.showToast(`Backpack full: Placed ${item.displayName} on ground.`);
    }
    ctx.refresh();
  }
}

function spawnTestMonster(ctx: DiagnosticTabContext, engine: GameEngine, mobId: string): void {
  const monster = engine.diagnostics.spawnMonster(mobId, { aiState: 'hunting' });
  if (monster) {
    ctx.showToast(`Spawned ${monster.name} at (${monster.x}, ${monster.y})!`);
    ctx.refresh();
  } else {
    ctx.showToast('No passable adjacent tile to spawn monster.');
  }
}

export function renderTriageTab(ctx: DiagnosticTabContext, engine: GameEngine): void {
  const container = ctx.container;
  const p = engine.player;
  const isLocked = ctx.inputContext?.getInputLocked() ?? false;
  const isGodMode = p?.isInvulnerable ?? false;

  const sampleMobs = (
    engine.manifest?.monsters && engine.manifest.monsters.length > 0
      ? engine.manifest.monsters
      : engine.registries.monsters.getAll()
  ).slice(0, 3);
  const mobButtonsHtml = sampleMobs.length > 0
    ? sampleMobs
        .map(
          (m) =>
            `<button class="win-btn btn-spawn-monster" data-mob="${m.id}" style="padding: 3px 8px;">+ ${m.name}</button>`
        )
        .join('\n')
    : `<button class="win-btn btn-spawn-monster" data-mob="" style="padding: 3px 8px;">+ No Monsters</button>`;

  container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #090d16; color: #e2e8f0; border: 2px inset #ffffff; flex: 1;">
        
        <!-- Emergency Correction Triggers -->
        <div style="background: #1e293b; padding: 10px; border-radius: 4px; border-left: 4px solid #f59e0b;">
          <div style="color: #fbbf24; font-weight: bold; font-size: 12px; margin-bottom: 8px;">
            🛠️ Emergency State-Correction &amp; Simulation Triggers
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="btn-triage-clear-lock" class="win-btn ${isLocked ? 'danger-btn' : ''}" style="font-weight: bold; padding: 4px 10px;">
              🔓 Force Clear Lock ${isLocked ? '(ACTIVE)' : ''}
            </button>
            <button id="btn-triage-step-tick" class="win-btn" style="font-weight: bold; padding: 4px 10px;">
              ⏭️ Step 1 Tick (Deterministic Pass)
            </button>
            <button id="btn-triage-toggle-god" class="win-btn ${isGodMode ? 'primary-btn' : ''}" style="font-weight: bold; padding: 4px 10px;">
              🛡️ ${isGodMode ? 'Disable God Mode' : 'Enable God Mode (Invulnerable)'}
            </button>
            <button id="btn-triage-reveal-map" class="win-btn" style="font-weight: bold; padding: 4px 10px;">
              👁️ Reveal Current Floor Map
            </button>
          </div>
        </div>

        <!-- Test Entity & Item Spawner -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px;">
          
          <!-- Item Spawns -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              🧪 Spawn Test Equipment &amp; Potions
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <button class="win-btn btn-spawn-item" data-item="potion" style="padding: 3px 8px;">+ Healing Potion</button>
                <button class="win-btn btn-spawn-item" data-item="blessed" style="padding: 3px 8px;">+ Blessed Sword</button>
                <button class="win-btn btn-spawn-item" data-item="cursed" style="padding: 3px 8px;">+ Cursed Mace</button>
                <button class="win-btn btn-spawn-item" data-item="chaotic" style="padding: 3px 8px;">+ Chaotic Warpblade</button>
              </div>
            </div>
          </div>

          <!-- Monster Spawns -->
          <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px;">
              👾 Spawn Test Monster (Adjacent)
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${mobButtonsHtml}
              </div>
            </div>
          </div>

        </div>

        <!-- Telemetry Export & Feedback Tools -->
        <div style="background: #0f172a; padding: 10px; border: 1px solid #334155; border-radius: 4px;">
          <div style="color: #38bdf8; font-weight: bold; margin-bottom: 6px; border-bottom: 1px solid #1e293b; padding-bottom: 2px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <span>📋 Telemetry Report &amp; Feedback Tools</span>
            <button id="btn-diag-open-feedback" class="win-btn primary-btn" style="padding: 2px 8px; font-size: 10px; font-weight: bold; background: #0284c7; color: white;">
              💬 Open Feedback / Bug Reporter
            </button>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <button id="btn-diag-copy" class="win-btn primary-btn" style="font-weight: bold; padding: 4px 10px;">📋 Copy Diagnostics</button>
            <button id="btn-diag-download" class="win-btn" style="padding: 4px 10px;">💾 Download .md</button>
            <button id="btn-diag-clear" class="win-btn danger-btn" style="padding: 4px 10px;">Clear Log Buffer</button>
            <button id="btn-diag-refresh" class="win-btn" style="padding: 4px 10px;">🔄 Refresh Telemetry</button>
          </div>

          <!-- Archived Logs Sub-section -->
          <div id="diag-crash-logs-container" style="margin-top: 8px; border-top: 1px dashed #334155; padding-top: 6px; display: none;">
            <div style="font-size: 10px; color: #94a3b8; margin-bottom: 4px; font-weight: bold;">📜 Archived Crash Logs in Local Storage:</div>
            <div id="diag-crash-logs-list" style="display: flex; flex-direction: column; gap: 4px; max-height: 90px; overflow-y: auto;"></div>
          </div>
        </div>

      </div>
    `;

  // Hook up triage buttons
  const clearLockBtn = container.querySelector('#btn-triage-clear-lock');
  clearLockBtn?.addEventListener('click', () => {
    ctx.inputContext?.clearInputLock();
    ctx.showToast('Input lock cleared. Keyboard responsiveness restored.');
    ctx.refresh();
  });

  const stepTickBtn = container.querySelector('#btn-triage-step-tick');
  stepTickBtn?.addEventListener('click', () => {
    if (engine.player) {
      engine.dispatchAction(new WaitAction(engine.player));
      ctx.showToast('Executed 1 deterministic simulation tick.');
      ctx.refresh();
    }
  });

  const toggleGodBtn = container.querySelector('#btn-triage-toggle-god');
  toggleGodBtn?.addEventListener('click', () => {
    const isInvulnerable = engine.diagnostics.toggleGodMode();
    ctx.showToast(`Invulnerability ${isInvulnerable ? 'ENABLED (God Mode)' : 'DISABLED'}.`);
    ctx.refresh();
  });

  const revealMapBtn = container.querySelector('#btn-triage-reveal-map');
  revealMapBtn?.addEventListener('click', () => {
    engine.diagnostics.revealFloorMap();
    ctx.showToast('Floor map revealed (Clairvoyance).');
    ctx.refresh();
  });

  // Spawn item buttons
  const spawnItemBtns = container.querySelectorAll<HTMLButtonElement>('.btn-spawn-item');
  spawnItemBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const itemType = btn.getAttribute('data-item');
      spawnTestItem(ctx, engine, itemType);
    });
  });

  // Spawn monster buttons
  const spawnMobBtns = container.querySelectorAll<HTMLButtonElement>('.btn-spawn-monster');
  spawnMobBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mobId = btn.getAttribute('data-mob');
      if (mobId) {
        spawnTestMonster(ctx, engine, mobId);
      }
    });
  });

  // Telemetry buttons
  const copyBtn = container.querySelector('#btn-diag-copy');
  copyBtn?.addEventListener('click', () => {
    if (ctx.copyReport) {
      void ctx.copyReport();
    }
  });

  const downloadBtn = container.querySelector('#btn-diag-download');
  downloadBtn?.addEventListener('click', () => {
    if (ctx.downloadReport) {
      ctx.downloadReport();
    }
  });

  const clearBtn = container.querySelector('#btn-diag-clear');
  clearBtn?.addEventListener('click', () => {
    flightRecorder.clear();
    ctx.showToast('Flight log buffer cleared.');
    ctx.refresh();
  });

  const refreshBtn = container.querySelector('#btn-diag-refresh');
  refreshBtn?.addEventListener('click', () => {
    ctx.refresh();
    ctx.showToast('Telemetry refreshed.');
  });

  const openFeedbackBtn = container.querySelector('#btn-diag-open-feedback');
  openFeedbackBtn?.addEventListener('click', () => {
    if (ctx.openFeedback) {
      ctx.openFeedback();
    }
  });

  // Render archived logs if available
  if (ctx.bulkArchive) {
    const logsContainer = container.querySelector<HTMLElement>('#diag-crash-logs-container');
    const logsList = container.querySelector<HTMLElement>('#diag-crash-logs-list');
    ctx.bulkArchive.listFlightLogs().then((logs) => {
      if (logs.length > 0 && logsContainer && logsList) {
        logsContainer.style.display = 'block';
        logsList.innerHTML = logs.map((log) => `
          <div style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 2px 6px; border-radius: 2px;">
            <span style="color: #f87171; font-family: monospace; font-size: 10px;">${log}</span>
            <button class="win-btn btn-copy-archived-log" data-log="${log}" style="padding: 1px 6px; font-size: 9px;">📋 Copy</button>
          </div>
        `).join('');

        logsList.querySelectorAll<HTMLButtonElement>('.btn-copy-archived-log').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const label = btn.getAttribute('data-log');
            if (label && ctx.bulkArchive) {
              const events = await ctx.bulkArchive.getFlightLog(label);
              if (events) {
                await copyTextToClipboard(JSON.stringify(events, null, 2));
                ctx.showToast(`Archived crash '${label}' copied to clipboard.`);
              }
            }
          });
        });
      }
    }).catch(() => undefined);
  }
}

