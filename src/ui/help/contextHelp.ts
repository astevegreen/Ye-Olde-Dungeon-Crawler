import type { GameEngine } from '../../engine';
import type { InventoryOverlay } from '../../rendering/inventory-overlay';
import type { TargetingOverlay } from '../../rendering/targeting-overlay';
import type { ShopOverlay } from '../../rendering/shop-overlay';
import type { InspectOverlay } from '../../rendering/inspect-overlay';
import type { MapOverlay } from '../../rendering/map-overlay';

export type GameHelpContext = 'exploration' | 'town' | 'inventory' | 'targeting' | 'inspect' | 'shop' | 'map';

export interface HelpCardContent {
  title: string;
  contextTag: string;
  bullets: Array<{ key: string; label: string }>;
  tip: string;
}

export class ContextHelp {
  private overlayEl: HTMLElement | null = null;
  private isOpenState = false;
  private onDismissCallback?: () => void;

  constructor() {
    this.createDom();
  }

  private createDom(): void {
    if (typeof document === 'undefined') return;

    let overlay = document.getElementById('context-help-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'context-help-overlay';
      overlay.style.cssText = `
        position: absolute;
        top: 48px;
        right: 16px;
        z-index: 110;
        pointer-events: auto;
        display: none;
      `;
      document.getElementById('app')?.appendChild(overlay);
    }
    this.overlayEl = overlay;
  }

  public get isOpen(): boolean {
    return this.isOpenState;
  }

  public detectContext(
    engine: GameEngine,
    inventoryOverlay?: InventoryOverlay,
    targetingOverlay?: TargetingOverlay,
    shopOverlay?: ShopOverlay,
    inspectOverlay?: InspectOverlay,
    mapOverlay?: MapOverlay
  ): GameHelpContext {
    if (mapOverlay?.isOpen) return 'map';
    if (shopOverlay?.isOpen) return 'shop';
    if (inspectOverlay?.isOpen) return 'inspect';
    if (targetingOverlay?.isOpen) return 'targeting';
    if (inventoryOverlay?.isOpen) return 'inventory';
    if (engine.currentFloor === 0) return 'town';
    return 'exploration';
  }

  public getHelpContent(context: GameHelpContext): HelpCardContent {
    switch (context) {
      case 'shop':
        return {
          title: 'Town Merchant & Services',
          contextTag: 'COMMERCE & SANCTUARY',
          bullets: [
            { key: 'Tab / S', label: 'Toggle Buy Stock vs Sell Items' },
            { key: '1-9 / Space', label: 'Purchase or Sell selected merchandise' },
            { key: 'C / H', label: 'Cleanse Curses (50 GP) or Heal & Vitality (25 GP)' },
            { key: 'I / A / B', label: 'Identify items, Seek Run Advisory, or Open Codex' },
            { key: 'Esc', label: 'Exit shop or return to town streets' },
          ],
          tip: 'Tip: Always compact loose copper and silver at Banker Haakon before entering the dungeon!',
        };

      case 'inspect':
        return {
          title: 'Look / Inspect Mode',
          contextTag: 'TACTICAL OBSERVATION',
          bullets: [
            { key: 'Arrows / Vi / Numpad', label: 'Pan inspection reticle across visible tiles' },
            { key: 'L / X / Esc', label: 'Exit Look mode (Turn scheduler remains frozen)' },
          ],
          tip: 'Tip: Inspecting monsters reveals telegraphed wind-up intents, attack targets, and affinities.',
        };

      case 'targeting':
        return {
          title: 'Spell Casting & Reticle Aim',
          contextTag: 'ARCANE TARGETING',
          bullets: [
            { key: '1-9', label: 'Select spell from memorized spellbook' },
            { key: 'Arrows / Numpad', label: 'Aim trajectory reticle at target monster' },
            { key: 'Enter / Space', label: 'Release arcane spell bolt' },
            { key: 'Esc', label: 'Cancel casting without expending mana' },
          ],
          tip: 'Tip: Elemental spells deal bonus damage against monsters weak to fire, cold, or lightning.',
        };

      case 'inventory':
        return {
          title: 'Inventory & Paperdoll Equipment',
          contextTag: 'EQUIPMENT MANAGEMENT',
          bullets: [
            { key: '1-9', label: 'Quick-equip item from primary backpack' },
            { key: 'U', label: 'Unequip equipped main-hand or armor item' },
            { key: 'D', label: 'Drop top backpack item onto current ground tile' },
            { key: 'O', label: 'Cycle backpack sorting (Category -> Weight -> Bulk)' },
            { key: 'C', label: 'Consolidate loose backpack coins into coin purse' },
            { key: 'I / Esc', label: 'Close inventory panel' },
          ],
          tip: 'Tip: Click items to examine stats, enchanted +X bonuses, and elemental burst affixes.',
        };

      case 'town':
        return {
          title: 'Bjarnarhaven Haven (Floor 0)',
          contextTag: 'SAFE HAVEN',
          bullets: [
            { key: 'Bump NPC', label: 'Olaf (General), Gunther (Smith), Astrid (Alchemy)' },
            { key: 'Sage Mimir', label: 'Identify items & Seek Strategic Run Advisory' },
            { key: 'Banker Haakon', label: 'Compact heavy copper/silver into lightweight gold' },
            { key: 'Father Torvald', label: 'Temple of Thor: shatter curses and restore full vitality' },
            { key: 'B', label: 'Open Slayer’s Compendium & Monster Codex' },
            { key: 'Shift+? / Ctrl+K', label: 'Open Quick Command Palette' },
          ],
          tip: 'Tip: Store supplies or bank coinage before entering the northeast cellar staircase!',
        };

      case 'map':
        return {
          title: 'Explored Dungeon Map',
          contextTag: 'DUNGEON CARTOGRAPHY',
          bullets: [
            { key: '< / > or PgUp / PgDn', label: 'Browse visited dungeon floor maps' },
            { key: 'M / Esc / Space', label: 'Close Map Viewer' },
          ],
          tip: 'Tip: Explored map viewer costs 0 turns and displays visited rooms, corridors, and stairs.',
        };

      case 'exploration':
      default:
        return {
          title: 'Dungeon Exploration',
          contextTag: 'DUNGEON DESCENT',
          bullets: [
            { key: 'Arrows / Numpad / Vi', label: '8-way movement, bump attack, or open doors' },
            { key: 'Space / .', label: 'Wait a single turn (regenerates energy)' },
            { key: 'M', label: 'Explored Dungeon Map Viewer (0 turns)' },
            { key: 'X / L', label: 'Look / Inspect tiles and monster intents' },
            { key: 'Shift+G / Shift+,', label: 'Quick-Loot all items on ground tile' },
            { key: 'Z / C', label: 'Open Spellbook and cast known spells' },
            { key: 'I', label: 'Open Inventory, Paperdoll, and Containers' },
            { key: 'B', label: 'Open Slayer’s Compendium & Bestiary Codex' },
            { key: 'Shift+? / Ctrl+K', label: 'Open Quick Command Palette' },
            { key: 'R / S', label: 'Rest until healed (R) / Search for hidden traps (S)' },
            { key: '> / <', label: 'Climb stairs down (>) or climb stairs up (<)' },
            { key: 'Q', label: 'Save progress and return to character roster' },
          ],
          tip: 'Tip: Killing monsters 5+ times unlocks +1 ATK and +5% evasion mastery combat perks!',
        };
    }
  }

  public open(
    engine: GameEngine,
    inventoryOverlay?: InventoryOverlay,
    targetingOverlay?: TargetingOverlay,
    shopOverlay?: ShopOverlay,
    inspectOverlay?: InspectOverlay,
    mapOverlay?: MapOverlay,
    onDismiss?: () => void
  ): void {
    if (!this.overlayEl) return;
    this.onDismissCallback = onDismiss;

    const context = this.detectContext(engine, inventoryOverlay, targetingOverlay, shopOverlay, inspectOverlay, mapOverlay);
    const content = this.getHelpContent(context);

    this.overlayEl.innerHTML = `
      <div class="retro-window" style="width: 380px; box-shadow: 4px 4px 12px rgba(0,0,0,0.85); font-family: 'MS Sans Serif', monospace;">
        <div class="retro-titlebar" style="background: linear-gradient(90deg, #1e3a8a, #3b82f6); padding: 3px 6px;">
          <div class="retro-titlebar-title" style="font-size: 11px;">
            <span>💡</span>
            <span>${content.title} (F1)</span>
          </div>
          <button id="btn-context-help-close" class="win-btn win-btn-sm" style="padding: 0 4px; font-weight: bold; line-height: 1;">✕</button>
        </div>
        <div class="retro-window-body" style="padding: 8px; font-size: 11px; background: #c0c0c0;">
          <div style="font-weight: bold; color: #1e3a8a; font-size: 10px; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #808080; padding-bottom: 2px;">
            ${content.contextTag}
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
            ${content.bullets
              .map(
                (b) => `
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; background: #d4d4d4; padding: 2px 4px; border: 1px inset #fff;">
                <span style="font-family: monospace; font-weight: bold; color: #0f172a; white-space: nowrap;">[${b.key}]</span>
                <span style="color: #334155; text-align: right; font-size: 10px;">${b.label}</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div style="font-size: 10px; color: #15803d; font-style: italic; background: #ecfdf5; border: 1px solid #86efac; padding: 4px; margin-bottom: 6px;">
            ${content.tip}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b; border-top: 1px solid #808080; padding-top: 4px;">
            <span>Move, Esc, or F1 to dismiss</span>
            <span style="color: #1e3a8a; font-weight: bold;">Castle of the Winds</span>
          </div>
        </div>
      </div>
    `;

    document.getElementById('btn-context-help-close')?.addEventListener('click', () => {
      this.close();
    });

    this.overlayEl.style.display = 'block';
    this.isOpenState = true;
  }

  public close(): void {
    if (!this.isOpenState) return;
    this.isOpenState = false;
    if (this.overlayEl) {
      this.overlayEl.style.display = 'none';
    }
    if (this.onDismissCallback) {
      const cb = this.onDismissCallback;
      this.onDismissCallback = undefined;
      cb();
    }
  }

  public toggle(
    engine: GameEngine,
    inventoryOverlay?: InventoryOverlay,
    targetingOverlay?: TargetingOverlay,
    shopOverlay?: ShopOverlay,
    inspectOverlay?: InspectOverlay,
    mapOverlay?: MapOverlay,
    onDismiss?: () => void
  ): void {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open(engine, inventoryOverlay, targetingOverlay, shopOverlay, inspectOverlay, mapOverlay, onDismiss);
    }
  }
}
