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

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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
      create: (eng: GameEngine) => createScaledItem(def, eng.nextSimulationId(`item-${def.id}`), eng.currentFloor, eng.rng),
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

  container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; padding: 10px; font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; background: #090d16; color: #e2e8f0; border: 2px inset #ffffff; flex: 1;">

        <!-- Emergency Correction & Hero Triage -->
        <div style="background: #1e293b; padding: 8px 10px; border-radius: 4px; border-left: 4px solid #f59e0b;">
          <div style="color: #fbbf24; font-weight: bold; font-size: 11px; margin-bottom: 6px;">
            🛠️ Hero Triage &amp; Emergency State-Correction
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <button id="btn-triage-clear-lock" class="win-btn ${isLocked ? 'danger-btn' : ''}" style="font-weight: bold; padding: 3px 8px;">
              🔓 Force Clear Lock ${isLocked ? '(ACTIVE)' : ''}
            </button>
            <button id="btn-triage-toggle-god" class="win-btn ${isGodMode ? 'primary-btn' : ''}" style="font-weight: bold; padding: 3px 8px;">
              🛡️ ${isGodMode ? 'Disable God Mode' : 'Enable God Mode (Invulnerable)'}
            </button>
            <button id="btn-triage-heal-mana" class="win-btn" style="font-weight: bold; padding: 3px 8px;">💖 Full Heal &amp; Mana</button>
            <button id="btn-triage-clear-status" class="win-btn" style="padding: 3px 8px;">✨ Clear Status Afflictions</button>
            <button id="btn-triage-reveal-map" class="win-btn" style="padding: 3px 8px;">👁️ Reveal Current Floor Map</button>
            <button id="btn-triage-reveal-secrets" class="win-btn" style="padding: 3px 8px;">🚪 Reveal Traps &amp; Secret Doors</button>
            <button id="btn-triage-kill-visible" class="win-btn" style="padding: 3px 8px;">💀 Kill Visible Monsters</button>
            <button id="btn-triage-grant-level" class="win-btn" style="padding: 3px 8px;">⭐ Grant Level (Lv ${p.level})</button>
            <button id="btn-triage-identify-all" class="win-btn" style="padding: 3px 8px;">🔍 Identify All Carried</button>
          </div>
        </div>

        <!-- Simulation Stepper & Floor Teleportation Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">

          <!-- Simulation Turn Stepper -->
          <div style="background: #1e293b; padding: 8px 10px; border-radius: 4px; border-left: 4px solid #a855f7; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <div style="color: #c084fc; font-weight: bold; font-size: 11px;">⏱️ Simulation Turn Stepper</div>
              <div style="color: #94a3b8; font-size: 10px;">Turn: <strong style="color: #f8fafc;">#${engine.turnCount}</strong></div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <button id="btn-triage-step-tick" class="win-btn" style="font-weight: bold; padding: 3px 8px;">⏭️ Step 1 Turn</button>
              <button id="btn-triage-step-10" class="win-btn" style="padding: 3px 8px;">⏩ Step 10</button>
              <button id="btn-triage-step-50" class="win-btn" style="padding: 3px 8px;">⏩ Step 50</button>
              <div style="display: flex; align-items: center; gap: 4px; background: #0f172a; padding: 2px 6px; border: 1px solid #334155; border-radius: 3px;">
                <span style="color: #94a3b8; font-size: 10px;">Turns:</span>
                <input id="input-triage-step-turns" type="number" min="1" max="500" value="${stepTurnsVal}" style="width: 38px; background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 1px 4px; font-size: 10px; font-family: monospace;" />
                <button id="btn-triage-step-custom" class="win-btn" style="padding: 1px 6px; font-size: 10px; font-weight: bold;">Run</button>
              </div>
            </div>
          </div>

          <!-- Floor Navigation & Stair Teleportation -->
          <div style="background: #1e293b; padding: 8px 10px; border-radius: 4px; border-left: 4px solid #38bdf8; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <div style="color: #38bdf8; font-weight: bold; font-size: 11px;">🗺️ Floor Navigation &amp; Stairs</div>
              <div style="color: #94a3b8; font-size: 10px;">Current: <strong style="color: #f8fafc;">Floor ${currentFloorLabel}</strong></div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <button id="btn-triage-prev-floor" class="win-btn" style="padding: 3px 8px; font-weight: bold;">⏮️ Floor -1</button>
              <button id="btn-triage-next-floor" class="win-btn" style="padding: 3px 8px; font-weight: bold;">⏭️ Floor +1</button>
              <div style="display: flex; align-items: center; gap: 4px; background: #0f172a; padding: 2px 6px; border: 1px solid #334155; border-radius: 3px;">
                <span style="color: #94a3b8; font-size: 10px;">Jump:</span>
                <input id="input-triage-jump-floor" type="number" min="0" max="50" value="${nextFloorCandidate}" style="width: 38px; background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 1px 4px; font-size: 10px; font-family: monospace;" />
                <button id="btn-triage-jump-floor" class="win-btn" style="padding: 1px 6px; font-size: 10px; font-weight: bold;">Go</button>
              </div>
              <button id="btn-triage-stairs-down" class="win-btn" style="padding: 3px 8px;">⬇️ Stairs Down (&gt;)</button>
              <button id="btn-triage-stairs-up" class="win-btn" style="padding: 3px 8px;">⬆️ Stairs Up (&lt;)</button>
            </div>
          </div>

        </div>

        <!-- Reproduction: RNG state and loading a reported game -->
        <div style="background: #1e293b; padding: 8px 10px; border-radius: 4px; border-left: 4px solid #22c55e; display: flex; flex-direction: column; gap: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <div style="color: #4ade80; font-weight: bold; font-size: 11px;">🔁 Reproduction</div>
            <div id="triage-replay-status" style="color: #94a3b8; font-size: 10px;">${replayStatus}</div>
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
            <span style="color: #94a3b8; font-size: 10px;">PRNG state:</span>
            <input id="input-triage-prng" type="number" value="${engine.prng.getState()}" style="width: 110px; background: #0f172a; color: #e2e8f0; border: 1px solid #475569; padding: 1px 4px; font-size: 10px; font-family: monospace;" />
            <button id="btn-triage-set-prng" class="win-btn" style="padding: 1px 6px; font-size: 10px; font-weight: bold;">Set</button>
          </div>
          <textarea id="input-triage-report" placeholder="Paste a bug report (copied Markdown or .json), a replay block, or a save file..." style="width: 100%; box-sizing: border-box; height: 54px; background: #0f172a; color: #e2e8f0; border: 1px solid #475569; font-size: 10px; font-family: monospace;"></textarea>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
            <label style="display: flex; align-items: center; gap: 4px; cursor: pointer; color: #cbd5e1; font-size: 10px;">
              <input type="checkbox" id="check-triage-replay" checked /> Replay recorded actions after loading
            </label>
            <button id="btn-triage-load-report" class="win-btn primary-btn" style="padding: 2px 8px; font-size: 10px; font-weight: bold;">📥 Load State From Report</button>
          </div>
        </div>

        <!-- Searchable Entity & Item Spawner -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">

          <!-- Item Spawns -->
          <div style="background: #0f172a; padding: 8px 10px; border: 1px solid #334155; border-radius: 4px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">
              <span style="color: #38bdf8; font-weight: bold;">🧪 Spawn Items &amp; Equipment</span>
              <span id="badge-item-count" style="color: #94a3b8; font-size: 10px;"></span>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <input id="input-item-search" placeholder="Filter items..." value="${escapeHtml(itemSearchQuery)}" style="flex: 1; background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 2px 6px; font-size: 10px; font-family: monospace; border-radius: 2px;" />
            </div>
            <div id="item-category-pills" style="display: flex; gap: 3px; flex-wrap: wrap;">
              <!-- Rendered via updateItemPills -->
            </div>
            <div id="container-item-list" style="max-height: 120px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; background: #090d16; border: 1px inset #334155; border-radius: 2px;">
              <!-- Populated by updateItemList -->
            </div>
          </div>

          <!-- Monster Spawns -->
          <div style="background: #0f172a; padding: 8px 10px; border: 1px solid #334155; border-radius: 4px; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">
              <span style="color: #38bdf8; font-weight: bold;">👾 Spawn Monsters (Adjacent)</span>
              <span id="badge-monster-count" style="color: #94a3b8; font-size: 10px;"></span>
            </div>
            <div style="display: flex; gap: 4px; align-items: center;">
              <input id="input-monster-search" placeholder="Filter monsters..." value="${escapeHtml(monsterSearchQuery)}" style="flex: 1; background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 2px 6px; font-size: 10px; font-family: monospace; border-radius: 2px;" />
            </div>
            <div id="container-monster-list" style="max-height: 140px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 4px; padding: 4px; background: #090d16; border: 1px inset #334155; border-radius: 2px;">
              <!-- Populated by updateMonsterList -->
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
        const style = active
          ? 'background: #0284c7; color: white; font-weight: bold; border: 1px solid #38bdf8;'
          : 'background: #1e293b; color: #94a3b8; border: 1px solid #334155;';
        return `<button class="win-btn btn-item-filter-pill" data-cat="${c.id}" style="padding: 1px 6px; font-size: 9px; ${style}">${c.label}</button>`;
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
      itemListContainer.innerHTML = '<div style="color: #64748b; font-size: 10px; padding: 4px;">No matching items found.</div>';
      return;
    }

    itemListContainer.innerHTML = filtered
      .map(
        (it) =>
          `<button class="win-btn btn-spawn-item" data-item-id="${escapeHtml(it.id)}" style="padding: 2px 6px; font-size: 10px;">+ ${escapeHtml(it.name)}</button>`
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
      monsterListContainer.innerHTML = '<div style="color: #64748b; font-size: 10px; padding: 4px;">No matching monsters found.</div>';
      return;
    }

    monsterListContainer.innerHTML = filtered
      .map(
        (m) =>
          `<button class="win-btn btn-spawn-monster" data-mob="${escapeHtml(m.id)}" style="padding: 2px 6px; font-size: 10px;">+ ${escapeHtml(m.name)}</button>`
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
          logsContainer.style.display = 'block';
          logsList.innerHTML = logs
            .map(
              (log) => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 2px 6px; border-radius: 2px;">
              <span style="color: #f87171; font-family: monospace; font-size: 10px;">${escapeHtml(log)}</span>
              <button class="win-btn btn-copy-archived-log" data-log="${escapeHtml(log)}" style="padding: 1px 6px; font-size: 9px;">📋 Copy</button>
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
