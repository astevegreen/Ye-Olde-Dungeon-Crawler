import {
  ItemFactory,
  Item,
  PotionItem,
  WandItem,
  ScrollItem,
  WaitAction,
  createScaledItem,
  flightRecorder,
  type GameEngine,
} from '../../engine';
import type { DiagnosticTabContext } from './types';
import { copyTextToClipboard } from '../platform';
import { escapeHtml } from '../html';

type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'magic' | 'misc';

interface CatalogItemEntry {
  id: string;
  name: string;
  category: ItemCategory;
  create: (engine: GameEngine) => Item;
}

let itemSearchQuery = '';
let itemCategoryFilter: 'all' | ItemCategory = 'all';
let monsterSearchQuery = '';
let stepTurnsVal = 5;

function categorize(item: Item): ItemCategory {
  if (item instanceof WandItem || item instanceof ScrollItem) return 'magic';
  if (item instanceof PotionItem) return 'consumable';
  switch (item.category) {
    case 'weapon':
      return 'weapon';
    case 'armor':
    case 'shield':
    case 'helmet':
    case 'boots':
      return 'armor';
    case 'consumable':
    case 'food':
      return 'consumable';
    default:
      return 'misc';
  }
}

let factoryCatalog: CatalogItemEntry[] | null = null;

/**
 * Every argument-free `ItemFactory.create*` method, found by reflection so the menu
 * can't drift from the factory. A throwaway instance supplies the name and category;
 * items register with the item index only when placed, so it leaves no trace.
 */
function getFactoryItems(): CatalogItemEntry[] {
  if (factoryCatalog) return factoryCatalog;
  const factory = ItemFactory as unknown as Record<string, unknown>;
  const entries: CatalogItemEntry[] = [];
  for (const key of Object.getOwnPropertyNames(ItemFactory)) {
    const fn = factory[key];
    if (!key.startsWith('create') || typeof fn !== 'function' || fn.length > 0) continue;
    const make = (id?: string) => (fn as (id?: string) => Item).call(ItemFactory, id);
    let sample: Item;
    try {
      sample = make();
    } catch {
      continue;
    }
    if (!(sample instanceof Item)) continue;
    entries.push({
      id: `factory-${key}`,
      name: sample.displayName,
      category: categorize(sample),
      create: (e) => make(e.nextSimulationId(key.replace(/^create/, '').toLowerCase())),
    });
  }
  factoryCatalog = entries.sort((a, b) => a.name.localeCompare(b.name));
  return factoryCatalog;
}

/** Hand-built items exercising modifier systems no factory method produces. */
function getFixtureItems(): CatalogItemEntry[] {
  return [
    {
      id: 'fixture-blessed-sword',
      name: 'Blessed Longsword (modifier fixture)',
      category: 'weapon',
      create: (e) =>
        new Item({
          id: e.nextSimulationId('blessed'),
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
              id: e.nextSimulationId('mod-blessed'),
              name: 'Blessed',
              category: 'blessed',
              alignment: 'positive',
              meleeDamageMultiplier: 1.25,
              statDeltas: { attackBonus: 4 },
              prefix: 'Blessed',
            },
          ],
        }),
    },
    {
      id: 'fixture-chaotic-blade',
      name: 'Chaotic Warpblade (modifier fixture)',
      category: 'weapon',
      create: (e) =>
        new Item({
          id: e.nextSimulationId('chaotic'),
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
              id: e.nextSimulationId('mod-chaotic'),
              name: 'Chaotic Warp',
              category: 'chaotic',
              alignment: 'chaotic',
              extraMeleeStrikes: 1,
              missSelfDamage: 3,
              prefix: 'Chaotic',
            },
          ],
        }),
    },
  ];
}

function getAllCatalogItems(engine: GameEngine): CatalogItemEntry[] {
  const items = [...getFactoryItems(), ...getFixtureItems()];
  for (const def of engine.manifest?.items ?? []) {
    let cat: ItemCategory = 'misc';
    if (def.category === 'weapon') cat = 'weapon';
    else if (def.category === 'armor' || def.category === 'shield' || def.category === 'helmet' || def.category === 'boots') cat = 'armor';
    else if (def.category === 'consumable' || def.potionConfig) cat = 'consumable';
    else if (def.wandConfig || def.scrollConfig) cat = 'magic';

    items.push({
      id: `pack-${def.id}`,
      name: def.name,
      category: cat,
      create: (eng: GameEngine) =>
        createScaledItem(def, eng.nextSimulationId(`item-${def.id}`), eng.currentFloor, eng.rng, eng.manifest.itemFamilies),
    });
  }
  return items;
}

function getAllMonsters(engine: GameEngine): Array<{ id: string; name: string }> {
  const fromManifest = engine.manifest?.monsters ?? [];
  const fromRegistry = engine.registries.monsters.getAll();
  const seen = new Set<string>();
  const mobs: Array<{ id: string; name: string }> = [];

  for (const m of [...fromManifest, ...fromRegistry]) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      mobs.push({ id: m.id, name: m.name });
    }
  }
  return mobs.sort((a, b) => a.name.localeCompare(b.name));
}

function spawnTestItem(ctx: DiagnosticTabContext, engine: GameEngine, item: Item): void {
  const p = engine.player;
  if (!p) return;

  const res = engine.diagnostics.spawnItem(item);
  if (res.placedInPack) {
    ctx.showToast(`Spawned ${item.displayName} in backpack.`);
  } else {
    ctx.showToast(`Backpack full: Placed ${item.displayName} on ground at (${p.x}, ${p.y}).`);
  }
  ctx.refresh();
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

/** Waits as the player, so every stepped turn is an ordinary, replayable action. */
function stepSimulationTurns(engine: GameEngine, count: number): number {
  let stepped = 0;
  for (let i = 0; i < count && engine.player.isAlive(); i++) {
    engine.handlePlayerAction(new WaitAction(engine.player));
    stepped++;
  }
  return stepped;
}

export function renderTriageTab(ctx: DiagnosticTabContext, engine: GameEngine): void {
  const container = ctx.container;
  const p = engine.player;
  const isLocked = ctx.inputContext?.getInputLocked() ?? false;
  const isGodMode = p?.isInvulnerable ?? false;

  const currentFloorLabel = engine.currentFloor === 0 ? '0 (Town)' : `${engine.currentFloor}`;
  const nextFloorCandidate = engine.currentFloor + 1;

  const allItems = getAllCatalogItems(engine);
  const allMonsters = getAllMonsters(engine);
  const replay = flightRecorder.getReplayData(engine);
  const replayStatus = replay
    ? `Checkpoint at turn ${replay.checkpoint.turn} (${escapeHtml(replay.checkpoint.reason)}), ${replay.trail.length} action(s) since`
    : 'No checkpoint yet (taken at the next action)';

  const btn = (id: string, label: string, variant = ''): string =>
    `<button type="button" id="${id}" class="ui-btn ui-btn--sm${variant ? ` ui-btn--${variant}` : ''}">${label}</button>`;

  container.innerHTML = `
    <div class="ui-card">
      <div class="ui-h">Hero triage</div>
      <div class="diag-row-wrap">
        ${btn('btn-triage-clear-lock', `Force clear lock${isLocked ? ' (locked)' : ''}`, isLocked ? 'danger' : '')}
        ${btn('btn-triage-toggle-god', isGodMode ? 'Disable god mode' : 'Enable god mode', isGodMode ? 'primary' : '')}
        ${btn('btn-triage-heal-mana', 'Full heal and mana')}
        ${btn('btn-triage-clear-status', 'Clear conditions')}
        ${btn('btn-triage-reveal-map', 'Reveal floor map')}
        ${btn('btn-triage-reveal-secrets', 'Reveal traps and secret doors')}
        ${btn('btn-triage-kill-visible', 'Kill visible monsters')}
        ${btn('btn-triage-grant-level', `Grant a level (now ${p.level})`)}
        ${btn('btn-triage-identify-all', 'Identify everything carried')}
        ${btn('btn-triage-end-prologue', 'End the opening scene')}
      </div>
    </div>

    <div class="diag-grid">
      <div class="ui-card">
        <div class="ui-h">Turns <small>turn ${engine.turnCount}</small></div>
        <div class="diag-row-wrap">
          ${btn('btn-triage-step-tick', 'Step 1')}
          ${btn('btn-triage-step-10', 'Step 10')}
          ${btn('btn-triage-step-50', 'Step 50')}
          <input id="input-triage-step-turns" class="ui-input is-short" type="number" min="1" max="500" value="${stepTurnsVal}" aria-label="Turns to step" />
          ${btn('btn-triage-step-custom', 'Run')}
        </div>
      </div>
      <div class="ui-card">
        <div class="ui-h">Floors <small>on floor ${currentFloorLabel}</small></div>
        <div class="diag-row-wrap">
          ${btn('btn-triage-prev-floor', 'Floor −1')}
          ${btn('btn-triage-next-floor', 'Floor +1')}
          <input id="input-triage-jump-floor" class="ui-input is-short" type="number" min="0" max="50" value="${nextFloorCandidate}" aria-label="Floor to jump to" />
          ${btn('btn-triage-jump-floor', 'Go')}
          ${btn('btn-triage-stairs-down', 'To stairs down')}
          ${btn('btn-triage-stairs-up', 'To stairs up')}
        </div>
      </div>
    </div>

    <div class="ui-card">
      <div class="ui-h">Reproduction <small id="triage-replay-status">${replayStatus}</small></div>
      <div class="diag-row-wrap">
        <span class="ui-muted">PRNG state</span>
        <input id="input-triage-prng" class="ui-input is-mid" type="number" value="${engine.prng.getState()}" aria-label="PRNG state" />
        ${btn('btn-triage-set-prng', 'Set')}
      </div>
      <textarea id="input-triage-report" class="ui-textarea" placeholder="Paste a bug report (copied Markdown or .json), a replay block, or a save file..."></textarea>
      <div class="diag-row-wrap">
        <label class="diag-check"><input type="checkbox" id="check-triage-replay" checked /> Replay the recorded actions after loading</label>
        ${btn('btn-triage-load-report', 'Load state from report', 'primary')}
      </div>
    </div>

    <div class="diag-grid">
      <div class="ui-card">
        <div class="ui-h">Spawn items <small id="badge-item-count"></small></div>
        <input id="input-item-search" class="ui-input" placeholder="Filter items..." value="${escapeHtml(itemSearchQuery)}" />
        <div id="item-category-pills" class="diag-row-wrap"></div>
        <div id="container-item-list" class="ui-inset diag-picker"></div>
      </div>
      <div class="ui-card">
        <div class="ui-h">Spawn monsters <small id="badge-monster-count"></small></div>
        <input id="input-monster-search" class="ui-input" placeholder="Filter monsters..." value="${escapeHtml(monsterSearchQuery)}" />
        <div id="container-monster-list" class="ui-inset diag-picker"></div>
      </div>
    </div>

    <div class="ui-card">
      <div class="ui-h">Report and feedback</div>
      <div class="diag-row-wrap">
        ${btn('btn-diag-copy', 'Copy diagnostics', 'primary')}
        ${btn('btn-diag-download', 'Download .md')}
        ${btn('btn-diag-clear', 'Clear log buffer', 'danger')}
        ${btn('btn-diag-refresh', 'Refresh')}
        ${btn('btn-diag-open-feedback', 'Open feedback and bug report')}
      </div>
      <div id="diag-crash-logs-container" hidden>
        <div class="ui-dialog-label diag-label">Archived crash logs in local storage</div>
        <div id="diag-crash-logs-list" class="diag-list is-scroll"></div>
      </div>
    </div>`;


  // --- Dynamic Item Catalog & Filtering ---
  const itemPillsContainer = container.querySelector<HTMLElement>('#item-category-pills');
  const itemListContainer = container.querySelector<HTMLElement>('#container-item-list');
  const itemCountBadge = container.querySelector<HTMLElement>('#badge-item-count');
  const itemSearchInput = container.querySelector<HTMLInputElement>('#input-item-search');

  const categories: Array<{ id: 'all' | ItemCategory; label: string }> = [
    { id: 'all', label: 'All' },
    { id: 'weapon', label: 'Weapons' },
    { id: 'armor', label: 'Armor' },
    { id: 'consumable', label: 'Consumables' },
    { id: 'magic', label: 'Magic' },
    { id: 'misc', label: 'Misc' },
  ];

  function updateItemPills(): void {
    if (!itemPillsContainer) return;
    itemPillsContainer.innerHTML = categories
      .map((c) => {
        const active = itemCategoryFilter === c.id;
        return `<button type="button" class="ui-btn ui-btn--sm${active ? ' ui-btn--primary' : ''} btn-item-filter-pill" data-cat="${c.id}" aria-pressed="${active}">${c.label}</button>`;
      })
      .join('');

    itemPillsContainer.querySelectorAll<HTMLButtonElement>('.btn-item-filter-pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute('data-cat') as typeof itemCategoryFilter | null;
        if (cat) {
          itemCategoryFilter = cat;
          updateItemPills();
          updateItemList();
        }
      });
    });
  }

  function updateItemList(): void {
    if (!itemListContainer) return;
    const query = itemSearchQuery.trim().toLowerCase();
    const filtered = allItems.filter((it) => {
      if (itemCategoryFilter !== 'all' && it.category !== itemCategoryFilter) return false;
      if (!query) return true;
      return it.name.toLowerCase().includes(query) || it.id.toLowerCase().includes(query);
    });

    if (itemCountBadge) {
      itemCountBadge.textContent = `(${filtered.length}/${allItems.length})`;
    }

    if (filtered.length === 0) {
      itemListContainer.innerHTML = '<div class="diag-empty">No matching items.</div>';
      return;
    }

    itemListContainer.innerHTML = filtered
      .map(
        (it) =>
          `<button type="button" class="ui-btn ui-btn--sm btn-spawn-item" data-item-id="${escapeHtml(it.id)}">+ ${escapeHtml(it.name)}</button>`
      )
      .join('');

    itemListContainer.querySelectorAll<HTMLButtonElement>('.btn-spawn-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-item-id');
        const entry = allItems.find((i) => i.id === id);
        if (entry) {
          spawnTestItem(ctx, engine, entry.create(engine));
        }
      });
    });
  }

  itemSearchInput?.addEventListener('input', (e) => {
    itemSearchQuery = (e?.target as HTMLInputElement)?.value ?? itemSearchInput?.value ?? '';
    updateItemList();
  });

  updateItemPills();
  updateItemList();

  // --- Dynamic Monster Bestiary & Filtering ---
  const monsterListContainer = container.querySelector<HTMLElement>('#container-monster-list');
  const monsterCountBadge = container.querySelector<HTMLElement>('#badge-monster-count');
  const monsterSearchInput = container.querySelector<HTMLInputElement>('#input-monster-search');

  function updateMonsterList(): void {
    if (!monsterListContainer) return;
    const query = monsterSearchQuery.trim().toLowerCase();
    const filtered = allMonsters.filter((m) => {
      if (!query) return true;
      return m.name.toLowerCase().includes(query) || m.id.toLowerCase().includes(query);
    });

    if (monsterCountBadge) {
      monsterCountBadge.textContent = `(${filtered.length}/${allMonsters.length})`;
    }

    if (filtered.length === 0) {
      monsterListContainer.innerHTML = '<div class="diag-empty">No matching monsters.</div>';
      return;
    }

    monsterListContainer.innerHTML = filtered
      .map(
        (m) =>
          `<button type="button" class="ui-btn ui-btn--sm btn-spawn-monster" data-mob="${escapeHtml(m.id)}">+ ${escapeHtml(m.name)}</button>`
      )
      .join('');

    monsterListContainer.querySelectorAll<HTMLButtonElement>('.btn-spawn-monster').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mobId = btn.getAttribute('data-mob');
        if (mobId) {
          spawnTestMonster(ctx, engine, mobId);
        }
      });
    });
  }

  monsterSearchInput?.addEventListener('input', (e) => {
    monsterSearchQuery = (e?.target as HTMLInputElement)?.value ?? monsterSearchInput?.value ?? '';
    updateMonsterList();
  });

  updateMonsterList();

  // --- Hero Triage & Emergency Handlers ---
  const on = (selector: string, handler: () => void): void => {
    container.querySelector(selector)?.addEventListener('click', handler);
  };

  on('#btn-triage-clear-lock', () => {
    ctx.inputContext?.clearInputLock();
    ctx.showToast('Input lock cleared. Keyboard responsiveness restored.');
    ctx.refresh();
  });

  on('#btn-triage-toggle-god', () => {
    const isInvulnerable = engine.diagnostics.toggleGodMode();
    ctx.showToast(`Invulnerability ${isInvulnerable ? 'ENABLED (God Mode)' : 'DISABLED'}.`);
    ctx.refresh();
  });

  on('#btn-triage-heal-mana', () => {
    const restored = engine.diagnostics.restoreVitals();
    ctx.showToast(`Restored hero vitality: +${restored.hp} HP, +${restored.mana} Mana.`);
    ctx.refresh();
  });

  on('#btn-triage-clear-status', () => {
    const cleared = engine.diagnostics.clearStatusEffects();
    ctx.showToast(cleared === 0 ? 'Hero has no active status afflictions.' : `Cleared ${cleared} active status affliction(s).`);
    ctx.refresh();
  });

  on('#btn-triage-reveal-map', () => {
    engine.diagnostics.revealFloorMap();
    ctx.showToast('Floor map revealed (Clairvoyance).');
    ctx.refresh();
  });

  on('#btn-triage-reveal-secrets', () => {
    const found = engine.diagnostics.revealSecrets();
    ctx.showToast(`Revealed ${found.doors} secret door(s) and ${found.traps} hidden trap(s).`);
    ctx.refresh();
  });

  on('#btn-triage-kill-visible', () => {
    const killed = engine.diagnostics.killVisibleMonsters();
    ctx.showToast(killed === 0 ? 'No hostile monsters in view.' : `Killed ${killed} visible monster(s).`);
    ctx.refresh();
  });

  on('#btn-triage-grant-level', () => {
    const level = engine.diagnostics.grantLevel();
    ctx.showToast(`Hero is now level ${level}.`);
    ctx.refresh();
  });

  on('#btn-triage-end-prologue', () => {
    const ended = engine.diagnostics.endPrologue();
    ctx.showToast(ended ? 'The opening scene is over.' : 'No opening scene is under way.');
    ctx.refresh();
  });

  on('#btn-triage-identify-all', () => {
    const count = engine.diagnostics.identifyAll();
    ctx.showToast(count === 0 ? 'Everything carried is already identified.' : `Identified ${count} item(s).`);
    ctx.refresh();
  });

  // --- Simulation Stepper Handlers ---
  const step = (count: number): void => {
    const executed = stepSimulationTurns(engine, count);
    ctx.showToast(`Executed ${executed} simulation turn${executed === 1 ? '' : 's'}.`);
    ctx.refresh();
  };
  on('#btn-triage-step-tick', () => step(1));
  on('#btn-triage-step-10', () => step(10));
  on('#btn-triage-step-50', () => step(50));

  const stepTurnsInput = container.querySelector<HTMLInputElement>('#input-triage-step-turns');
  on('#btn-triage-step-custom', () => {
    const val = parseInt(stepTurnsInput?.value ?? '1', 10);
    stepTurnsVal = isNaN(val) ? 1 : Math.max(1, Math.min(500, val));
    step(stepTurnsVal);
  });

  // --- Floor Navigation Handlers ---
  const jump = (target: number): void => {
    const reached = engine.diagnostics.jumpToFloor(target);
    ctx.showToast(reached === 0 ? 'Moved to Town.' : `Moved to Floor ${reached}.`);
    ctx.refresh();
  };
  on('#btn-triage-prev-floor', () => jump(engine.currentFloor - 1));
  on('#btn-triage-next-floor', () => jump(engine.currentFloor + 1));

  const jumpFloorInput = container.querySelector<HTMLInputElement>('#input-triage-jump-floor');
  on('#btn-triage-jump-floor', () => {
    const val = parseInt(jumpFloorInput?.value ?? '1', 10);
    jump(isNaN(val) ? 1 : Math.min(50, val));
  });

  const teleport = (direction: 'up' | 'down'): void => {
    const pos = engine.diagnostics.teleportToStairs(direction);
    ctx.showToast(pos ? `Teleported to Stairs ${direction === 'down' ? 'Down' : 'Up'} at (${pos.x}, ${pos.y}).` : `No reachable stairs ${direction} on this floor.`);
    ctx.refresh();
  };
  on('#btn-triage-stairs-down', () => teleport('down'));
  on('#btn-triage-stairs-up', () => teleport('up'));

  // --- Reproduction Handlers ---
  const prngInput = container.querySelector<HTMLInputElement>('#input-triage-prng');
  on('#btn-triage-set-prng', () => {
    const val = Number(prngInput?.value);
    if (!Number.isFinite(val)) {
      ctx.showToast('Enter a number for the PRNG state.');
      return;
    }
    engine.diagnostics.setPrngState(val);
    ctx.showToast(`PRNG state set to ${engine.prng.getState()}.`);
    ctx.refresh();
  });

  const reportInput = container.querySelector<HTMLTextAreaElement>('#input-triage-report');
  const replayCheck = container.querySelector<HTMLInputElement>('#check-triage-replay');
  on('#btn-triage-load-report', () => {
    const text = reportInput?.value ?? '';
    if (!text.trim()) {
      ctx.showToast('Paste a bug report, replay block, or save first.');
      return;
    }
    if (!ctx.loadReportState) {
      ctx.showToast('Loading a report is not available here.');
      return;
    }
    ctx.showToast('Loading report...');
    void ctx.loadReportState(text, replayCheck?.checked ?? true).then((status) => ctx.showToast(status));
  });

  // --- Telemetry Reporting Handlers ---
  on('#btn-diag-copy', () => {
    if (ctx.copyReport) {
      void ctx.copyReport();
    }
  });

  on('#btn-diag-download', () => {
    if (ctx.downloadReport) {
      ctx.downloadReport();
    }
  });

  on('#btn-diag-clear', () => {
    flightRecorder.clear();
    ctx.showToast('Flight log buffer cleared.');
    ctx.refresh();
  });

  on('#btn-diag-refresh', () => {
    ctx.refresh();
    ctx.showToast('Telemetry refreshed.');
  });

  on('#btn-diag-open-feedback', () => {
    if (ctx.openFeedback) {
      ctx.openFeedback();
    }
  });

  // Render archived logs if available
  if (ctx.bulkArchive) {
    const logsContainer = container.querySelector<HTMLElement>('#diag-crash-logs-container');
    const logsList = container.querySelector<HTMLElement>('#diag-crash-logs-list');
    ctx.bulkArchive
      .listFlightLogs()
      .then((logs) => {
        if (logs.length > 0 && logsContainer && logsList) {
          logsContainer.hidden = false;
          logsList.innerHTML = logs
            .map(
              (log) => `
            <div class="diag-item is-bad">
              <span class="diag-v is-bad">${escapeHtml(log)}</span>
              <button type="button" class="ui-btn ui-btn--sm btn-copy-archived-log" data-log="${escapeHtml(log)}">Copy</button>
            </div>
          `
            )
            .join('');

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
      })
      .catch(() => undefined);
  }
}
