import {
  ItemFactory,
  Item,
  PotionItem,
  WaitAction,
  SearchAction,
  DrinkPotionAction,
  createScaledItem,
  flightRecorder,
  type GameEngine,
} from '../../engine';
import type { DiagnosticTabContext } from './types';
import { copyTextToClipboard } from '../platform';

export interface CatalogItemEntry {
  id: string;
  name: string;
  category: 'weapon' | 'armor' | 'consumable' | 'magic' | 'misc';
  create: (engine: GameEngine) => Item;
}

let itemSearchQuery = '';
let itemCategoryFilter: 'all' | 'weapon' | 'armor' | 'consumable' | 'magic' | 'misc' = 'all';
let monsterSearchQuery = '';
let stepTurnsVal = 5;

function getStandardItems(): CatalogItemEntry[] {
  return [
    // Weapons
    { id: 'dagger', name: 'Iron Dagger', category: 'weapon', create: (e) => ItemFactory.createDagger(e.nextSimulationId('dagger')) },
    { id: 'broadsword', name: 'Steel Broadsword', category: 'weapon', create: (e) => ItemFactory.createBroadsword(e.nextSimulationId('sword')) },
    { id: 'frost-blade', name: 'Frost Broadsword', category: 'weapon', create: (e) => ItemFactory.createFrostBlade(e.nextSimulationId('frost')) },
    { id: 'battleaxe', name: 'Bearded Battleaxe', category: 'weapon', create: (e) => ItemFactory.createBattleaxe(e.nextSimulationId('axe')) },
    { id: 'cursed-mace', name: 'Spiked Mace (Cursed)', category: 'weapon', create: (e) => ItemFactory.createCursedMace(e.nextSimulationId('mace')) },
    {
      id: 'blessed-sword',
      name: 'Blessed Longsword',
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
      id: 'chaotic-blade',
      name: 'Chaotic Warpblade',
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

    // Armor & Shields
    { id: 'leather-armor', name: 'Studded Leather Armor', category: 'armor', create: (e) => ItemFactory.createLeatherArmor(e.nextSimulationId('armor')) },
    { id: 'iron-chainmail', name: 'Iron Chainmail', category: 'armor', create: (e) => ItemFactory.createChainmail(e.nextSimulationId('ironmail')) },
    { id: 'plate-armor', name: 'Full Plate Armor', category: 'armor', create: (e) => ItemFactory.createPlateArmor(e.nextSimulationId('plate')) },
    { id: 'iron-helm', name: 'Iron Helmet', category: 'armor', create: (e) => ItemFactory.createIronHelmet(e.nextSimulationId('helm')) },
    { id: 'boots', name: 'Traveler Boots', category: 'armor', create: (e) => ItemFactory.createBoots(e.nextSimulationId('boots')) },
    { id: 'wood-shield', name: 'Wooden Shield', category: 'armor', create: (e) => ItemFactory.createWoodenShield(e.nextSimulationId('shield')) },
    { id: 'iron-shield', name: 'Iron Tower Shield', category: 'armor', create: (e) => ItemFactory.createIronShield(e.nextSimulationId('shield-iron')) },

    // Consumables
    { id: 'potion-hp', name: 'Minor Health Potion', category: 'consumable', create: (e) => ItemFactory.createHealthPotion(e.nextSimulationId('potion-hp')) },
    { id: 'potion-mana', name: 'Mana Draught', category: 'consumable', create: (e) => ItemFactory.createManaPotion(e.nextSimulationId('potion-mana')) },
    { id: 'potion-antidote', name: 'Purifying Antidote', category: 'consumable', create: (e) => ItemFactory.createAntidotePotion(e.nextSimulationId('potion-antidote')) },
    { id: 'potion-volatile', name: 'Draught of Volatile Energy', category: 'consumable', create: (e) => ItemFactory.createDraughtOfVolatileEnergy(e.nextSimulationId('potion-ve')) },
    { id: 'rations', name: 'Iron Rations', category: 'consumable', create: (e) => ItemFactory.createRations(e.nextSimulationId('rations')) },
    { id: 'travel-bread', name: 'Travel Bread', category: 'consumable', create: (e) => ItemFactory.createTravelBread(e.nextSimulationId('bread')) },

    // Magic
    { id: 'wand-lightning', name: 'Wand of Lightning', category: 'magic', create: (e) => ItemFactory.createWandOfLightning(e.nextSimulationId('wand-lt')) },
    { id: 'wand-fireball', name: 'Wand of Fireballs', category: 'magic', create: (e) => ItemFactory.createWandOfFireballs(e.nextSimulationId('wand-fb')) },
    { id: 'scroll-identify', name: 'Scroll of Identify', category: 'magic', create: (e) => ItemFactory.createScrollOfIdentify(e.nextSimulationId('scroll-id')) },
    { id: 'scroll-teleport', name: 'Scroll of Phase Door', category: 'magic', create: (e) => ItemFactory.createScrollOfTeleport(e.nextSimulationId('scroll-tp')) },

    // Misc & Containers
    { id: 'utility-belt', name: 'Leather Utility Belt', category: 'misc', create: (e) => ItemFactory.createUtilityBelt(e.nextSimulationId('belt')) },
    { id: 'coin-purse', name: 'Velvet Coin Purse', category: 'misc', create: (e) => ItemFactory.createCoinPurse(e.nextSimulationId('purse')) },
    { id: 'iron-chest', name: 'Heavy Iron Chest', category: 'misc', create: (e) => ItemFactory.createIronChest(e.nextSimulationId('chest')) },
    { id: 'lockpicks', name: 'Thief Lockpicks', category: 'misc', create: (e) => ItemFactory.createLockpicks(e.nextSimulationId('picks')) },
    { id: 'torch', name: 'Wooden Torch', category: 'misc', create: (e) => ItemFactory.createTorch(e.nextSimulationId('torch')) },
    { id: 'gold-coins', name: '100 Gold Coins', category: 'misc', create: (e) => ItemFactory.createGoldCoins(e.nextSimulationId('coins'), 100) },
    { id: 'cursed-ring', name: 'Ring of Clumsiness (Cursed)', category: 'misc', create: (e) => ItemFactory.createCursedRing(e.nextSimulationId('ring')) },
  ];
}

function getAllCatalogItems(engine: GameEngine): CatalogItemEntry[] {
  const items = [...getStandardItems()];
  if (engine.manifest?.items && Array.isArray(engine.manifest.items)) {
    for (const def of engine.manifest.items) {
      let cat: 'weapon' | 'armor' | 'consumable' | 'magic' | 'misc' = 'misc';
      if (def.category === 'weapon') cat = 'weapon';
      else if (def.category === 'armor' || def.category === 'shield' || def.category === 'helmet' || def.category === 'boots') cat = 'armor';
      else if (def.category === 'consumable' || def.potionConfig) cat = 'consumable';
      else if (def.wandConfig || def.scrollConfig) cat = 'magic';

      items.push({
        id: `pack-${def.id}`,
        name: def.name,
        category: cat,
        create: (eng: GameEngine) =>
          createScaledItem(def, eng.nextSimulationId(`item-${def.id}`), eng.currentFloor, eng.rng),
      });
    }
  }
  return items;
}

function getAllMonsters(engine: GameEngine): Array<{ id: string; name: string }> {
  const fromManifest =
    engine.manifest?.monsters && engine.manifest.monsters.length > 0 ? engine.manifest.monsters : [];
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

function stepSimulationTurns(engine: GameEngine, count: number): number {
  if (!engine.player || !engine.player.isAlive()) return 0;
  let stepped = 0;
  for (let i = 0; i < count; i++) {
    if (!engine.player.isAlive()) break;
    engine.dispatchAction(new WaitAction(engine.player));
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
            <button id="btn-triage-heal-mana" class="win-btn" style="font-weight: bold; padding: 3px 8px;">
              💖 Full Heal &amp; Mana
            </button>
            <button id="btn-triage-clear-status" class="win-btn" style="padding: 3px 8px;">
              ✨ Clear Status Afflictions
            </button>
            <button id="btn-triage-reveal-map" class="win-btn" style="padding: 3px 8px;">
              👁️ Reveal Current Floor Map
            </button>
            <button id="btn-triage-reveal-secrets" class="win-btn" style="padding: 3px 8px;">
              🚪 Reveal Traps &amp; Secret Doors
            </button>
          </div>
        </div>

        <!-- Simulation Stepper & Floor Teleportation Row -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
          
          <!-- Simulation Turn Stepper -->
          <div style="background: #1e293b; padding: 8px 10px; border-radius: 4px; border-left: 4px solid #a855f7; display: flex; flex-direction: column; gap: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
              <div style="color: #c084fc; font-weight: bold; font-size: 11px;">
                ⏱️ Simulation Turn Stepper
              </div>
              <div style="color: #94a3b8; font-size: 10px;">
                Turn: <strong style="color: #f8fafc;">#${engine.turnCount}</strong>
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <button id="btn-triage-step-tick" class="win-btn" style="font-weight: bold; padding: 3px 8px;">
                ⏭️ Step 1 Turn
              </button>
              <button id="btn-triage-step-10" class="win-btn" style="padding: 3px 8px;">
                ⏩ Step 10
              </button>
              <button id="btn-triage-step-50" class="win-btn" style="padding: 3px 8px;">
                ⏩ Step 50
              </button>
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
              <div style="color: #38bdf8; font-weight: bold; font-size: 11px;">
                🗺️ Floor Navigation &amp; Stairs
              </div>
              <div style="color: #94a3b8; font-size: 10px;">
                Current: <strong style="color: #f8fafc;">Floor ${currentFloorLabel}</strong>
              </div>
            </div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <button id="btn-triage-prev-floor" class="win-btn" style="padding: 3px 8px; font-weight: bold;">
                ⏮️ Floor -1
              </button>
              <button id="btn-triage-next-floor" class="win-btn" style="padding: 3px 8px; font-weight: bold;">
                ⏭️ Floor +1
              </button>
              <div style="display: flex; align-items: center; gap: 4px; background: #0f172a; padding: 2px 6px; border: 1px solid #334155; border-radius: 3px;">
                <span style="color: #94a3b8; font-size: 10px;">Jump:</span>
                <input id="input-triage-jump-floor" type="number" min="0" max="50" value="${nextFloorCandidate}" style="width: 38px; background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 1px 4px; font-size: 10px; font-family: monospace;" />
                <button id="btn-triage-jump-floor" class="win-btn" style="padding: 1px 6px; font-size: 10px; font-weight: bold;">Go</button>
              </div>
              <button id="btn-triage-stairs-down" class="win-btn" style="padding: 3px 8px;">
                ⬇️ Stairs Down (&gt;)
              </button>
              <button id="btn-triage-stairs-up" class="win-btn" style="padding: 3px 8px;">
                ⬆️ Stairs Up (&lt;)
              </button>
            </div>
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
              <input id="input-item-search" placeholder="Filter items..." value="${itemSearchQuery}" style="flex: 1; background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 2px 6px; font-size: 10px; font-family: monospace; border-radius: 2px;" />
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
              <input id="input-monster-search" placeholder="Filter monsters..." value="${monsterSearchQuery}" style="flex: 1; background: #1e293b; color: #e2e8f0; border: 1px solid #475569; padding: 2px 6px; font-size: 10px; font-family: monospace; border-radius: 2px;" />
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

  const categories: Array<{ id: 'all' | 'weapon' | 'armor' | 'consumable' | 'magic' | 'misc'; label: string }> = [
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
      itemListContainer.innerHTML =
        '<div style="color: #64748b; font-size: 10px; padding: 4px;">No matching items found.</div>';
      return;
    }

    itemListContainer.innerHTML = filtered
      .map(
        (it) =>
          `<button class="win-btn btn-spawn-item" data-item-id="${it.id}" style="padding: 2px 6px; font-size: 10px;">+ ${it.name}</button>`
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
      monsterListContainer.innerHTML =
        '<div style="color: #64748b; font-size: 10px; padding: 4px;">No matching monsters found.</div>';
      return;
    }

    monsterListContainer.innerHTML = filtered
      .map(
        (m) =>
          `<button class="win-btn btn-spawn-monster" data-mob="${m.id}" style="padding: 2px 6px; font-size: 10px;">+ ${m.name}</button>`
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
  const clearLockBtn = container.querySelector('#btn-triage-clear-lock');
  clearLockBtn?.addEventListener('click', () => {
    ctx.inputContext?.clearInputLock();
    ctx.showToast('Input lock cleared. Keyboard responsiveness restored.');
    ctx.refresh();
  });

  const toggleGodBtn = container.querySelector('#btn-triage-toggle-god');
  toggleGodBtn?.addEventListener('click', () => {
    const isInvulnerable = engine.diagnostics.toggleGodMode();
    ctx.showToast(`Invulnerability ${isInvulnerable ? 'ENABLED (God Mode)' : 'DISABLED'}.`);
    ctx.refresh();
  });

  const healManaBtn = container.querySelector('#btn-triage-heal-mana');
  healManaBtn?.addEventListener('click', () => {
    if (p) {
      const hpDiff = p.maxHp - p.hp;
      const manaDiff = p.maxMana - p.mana;
      if (hpDiff > 0) p.heal(hpDiff);
      if (manaDiff > 0) p.restoreMana(manaDiff);
      ctx.showToast(`Restored hero vitality: +${hpDiff} HP, +${manaDiff} Mana.`);
      ctx.refresh();
    }
  });

  const clearStatusBtn = container.querySelector('#btn-triage-clear-status');
  clearStatusBtn?.addEventListener('click', () => {
    if (p) {
      const active = p.statusManager.getAll();
      if (active.length === 0) {
        ctx.showToast('Hero has no active status afflictions.');
      } else {
        const panacea = new PotionItem({
          id: engine.nextSimulationId('panacea'),
          name: 'Triage Panacea',
          potionType: 'antidote',
          effects: active.map((s) => ({
            type: 'cure_status',
            status: s.type,
          })),
        });
        const cost = p.getActionCost(100);
        new DrinkPotionAction(p, panacea).perform(engine);
        p.gainEnergy(cost); // Energy-neutral triage
        ctx.showToast(`Cleared ${active.length} active status affliction(s).`);
        ctx.refresh();
      }
    }
  });

  const revealMapBtn = container.querySelector('#btn-triage-reveal-map');
  revealMapBtn?.addEventListener('click', () => {
    engine.diagnostics.revealFloorMap();
    ctx.showToast('Floor map revealed (Clairvoyance).');
    ctx.refresh();
  });

  const revealSecretsBtn = container.querySelector('#btn-triage-reveal-secrets');
  revealSecretsBtn?.addEventListener('click', () => {
    if (p) {
      const searchAction = new SearchAction(
        p,
        () => 1.0,
        Math.max(engine.map.width, engine.map.height)
      );
      const cost = p.getActionCost(100);
      const res = searchAction.perform(engine);
      p.gainEnergy(cost);
      ctx.showToast(res.message ?? 'Revealed secret doors and hidden traps.');
      ctx.refresh();
    }
  });

  // --- Simulation Stepper Handlers ---
  const stepTickBtn = container.querySelector('#btn-triage-step-tick');
  stepTickBtn?.addEventListener('click', () => {
    const executed = stepSimulationTurns(engine, 1);
    ctx.showToast(`Executed ${executed} simulation turn.`);
    ctx.refresh();
  });

  const step10Btn = container.querySelector('#btn-triage-step-10');
  step10Btn?.addEventListener('click', () => {
    const executed = stepSimulationTurns(engine, 10);
    ctx.showToast(`Executed ${executed} simulation turns.`);
    ctx.refresh();
  });

  const step50Btn = container.querySelector('#btn-triage-step-50');
  step50Btn?.addEventListener('click', () => {
    const executed = stepSimulationTurns(engine, 50);
    ctx.showToast(`Executed ${executed} simulation turns.`);
    ctx.refresh();
  });

  const stepCustomBtn = container.querySelector('#btn-triage-step-custom');
  const stepTurnsInput = container.querySelector<HTMLInputElement>('#input-triage-step-turns');
  stepCustomBtn?.addEventListener('click', () => {
    const val = parseInt(stepTurnsInput?.value ?? '1', 10);
    const count = isNaN(val) ? 1 : Math.max(1, Math.min(500, val));
    stepTurnsVal = count;
    const executed = stepSimulationTurns(engine, count);
    ctx.showToast(`Executed ${executed} simulation turns.`);
    ctx.refresh();
  });

  // --- Floor Navigation Handlers ---
  const prevFloorBtn = container.querySelector('#btn-triage-prev-floor');
  prevFloorBtn?.addEventListener('click', () => {
    const target = Math.max(0, engine.currentFloor - 1);
    engine.changeFloor(target);
    ctx.showToast(target === 0 ? 'Climbed up into Town.' : `Ascended to Floor ${target}.`);
    ctx.refresh();
  });

  const nextFloorBtn = container.querySelector('#btn-triage-next-floor');
  nextFloorBtn?.addEventListener('click', () => {
    const target = engine.currentFloor + 1;
    engine.changeFloor(target);
    ctx.showToast(`Descended to Floor ${target}.`);
    ctx.refresh();
  });

  const jumpFloorBtn = container.querySelector('#btn-triage-jump-floor');
  const jumpFloorInput = container.querySelector<HTMLInputElement>('#input-triage-jump-floor');
  jumpFloorBtn?.addEventListener('click', () => {
    const val = parseInt(jumpFloorInput?.value ?? '1', 10);
    const target = isNaN(val) ? 1 : Math.max(0, Math.min(50, val));
    engine.changeFloor(target);
    ctx.showToast(target === 0 ? 'Jumped to Town.' : `Jumped to Floor ${target}.`);
    ctx.refresh();
  });

  const stairsDownBtn = container.querySelector('#btn-triage-stairs-down');
  stairsDownBtn?.addEventListener('click', () => {
    let stairPos: { x: number; y: number } | null = null;
    for (let y = 0; y < engine.map.height; y++) {
      for (let x = 0; x < engine.map.width; x++) {
        const tile = engine.map.getTile(x, y);
        if (tile?.type === 'stairs_down' || tile?.isStairsDown) {
          stairPos = { x, y: engine.currentFloor === 0 ? y + 1 : y };
          break;
        }
      }
      if (stairPos) break;
    }
    if (stairPos && p) {
      engine.map.moveEntity(p, stairPos.x, stairPos.y);
      engine.updateFov();
      ctx.showToast(`Teleported to Stairs Down at (${stairPos.x}, ${stairPos.y}).`);
      ctx.refresh();
    } else {
      ctx.showToast('No stairs down found on this floor.');
    }
  });

  const stairsUpBtn = container.querySelector('#btn-triage-stairs-up');
  stairsUpBtn?.addEventListener('click', () => {
    let stairPos: { x: number; y: number } | null = null;
    for (let y = 0; y < engine.map.height; y++) {
      for (let x = 0; x < engine.map.width; x++) {
        const tile = engine.map.getTile(x, y);
        if (tile?.type === 'stairs_up' || tile?.isStairsUp) {
          stairPos = { x, y };
          break;
        }
      }
      if (stairPos) break;
    }
    if (stairPos && p) {
      engine.map.moveEntity(p, stairPos.x, stairPos.y);
      engine.updateFov();
      ctx.showToast(`Teleported to Stairs Up at (${stairPos.x}, ${stairPos.y}).`);
      ctx.refresh();
    } else {
      ctx.showToast('No stairs up found on this floor.');
    }
  });

  // --- Telemetry Reporting Handlers ---
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
    ctx.bulkArchive
      .listFlightLogs()
      .then((logs) => {
        if (logs.length > 0 && logsContainer && logsList) {
          logsContainer.style.display = 'block';
          logsList.innerHTML = logs
            .map(
              (log) => `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 2px 6px; border-radius: 2px;">
              <span style="color: #f87171; font-family: monospace; font-size: 10px;">${log}</span>
              <button class="win-btn btn-copy-archived-log" data-log="${log}" style="padding: 1px 6px; font-size: 9px;">📋 Copy</button>
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
