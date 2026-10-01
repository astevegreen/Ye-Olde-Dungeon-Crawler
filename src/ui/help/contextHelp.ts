import { type GameContentManifest, type GameEngine, TempleService, formatCurrency } from '../../engine';
import { iconHtml } from '../icons';
import type { TargetingOverlay } from '../../rendering/targeting-overlay';
import type { ShopDialog } from '../shop/shopDialog';
import type { InspectOverlay } from '../../rendering/inspect-overlay';
import type { MapOverlay } from '../../rendering/map-overlay';
import { resolveBranding } from '../branding';

/** Whether a screen is open; the inventory is a character-menu tab, so callers say so. */
export interface OpenFlag {
  readonly isOpen: boolean;
}

export type GameHelpContext = 'exploration' | 'town' | 'inventory' | 'targeting' | 'inspect' | 'shop' | 'map';

export interface HelpCardContent {
  title: string;
  contextTag: string;
  bullets: Array<{ key: string; label: string }>;
  tip: string;
}

const TOWN_ROLE_HELP: Partial<Record<string, string>> = {
  merchant: 'Buy and sell goods',
  priest: 'Lift curses and restore vitality',
  sage: 'Identify items and seek run advice',
  banker: 'Compact heavy coins into lighter ones',
  trainer: 'Bond with and train a companion',
  guard: 'Local news and warnings',
};

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
        /* Above every menu and dialog (the character menu is 140, settings 250), so F1
           help is readable wherever it opens. */
        z-index: 280;
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
    inventory?: OpenFlag,
    targetingOverlay?: TargetingOverlay,
    shopOverlay?: ShopDialog,
    inspectOverlay?: InspectOverlay,
    mapOverlay?: MapOverlay
  ): GameHelpContext {
    if (mapOverlay?.isOpen) return 'map';
    if (shopOverlay?.isOpen) return 'shop';
    if (inspectOverlay?.isOpen) return 'inspect';
    if (targetingOverlay?.isOpen) return 'targeting';
    if (inventory?.isOpen) return 'inventory';
    if (engine.currentFloor === 0) return 'town';
    return 'exploration';
  }

  public getHelpContent(context: GameHelpContext, manifest?: GameContentManifest): HelpCardContent {
    switch (context) {
      case 'shop':
        return {
          title: 'Town Merchant & Services',
          contextTag: 'COMMERCE & SANCTUARY',
          bullets: [
            { key: 'B / S / Tab', label: 'Buy list, sell list, or switch between them' },
            { key: 'Enter / 1-9', label: 'Buy or sell the chosen item, or one by its number' },
            { key: 'C / H', label: `Cleanse curses (${formatCurrency(TempleService.CURSE_CLEANSE_COST_CP)}) or heal and restore (${formatCurrency(TempleService.HEAL_RESTORE_COST_CP)})` },
            { key: 'I / A / B', label: 'Identify items, Seek Run Advisory, or Open Bestiary' },
            { key: 'Esc', label: 'Exit shop or return to town streets' },
          ],
          tip: `Tip: Always compact loose copper and silver at ${resolveBranding(manifest).bankerTitle} before entering the dungeon!`,
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

      case 'town': {
        // The pack's own townsfolk, so the card never names another pack's town.
        const npcs = (manifest?.town?.npcs ?? []).slice(0, 5);
        return {
          title: `${manifest?.town?.name ?? 'Town'} (Floor 0)`,
          contextTag: 'SAFE HAVEN',
          bullets: [
            ...npcs.map((npc) => ({ key: npc.name, label: TOWN_ROLE_HELP[npc.role] ?? 'Talk by bumping into them' })),
            { key: 'B', label: 'Open Bestiary' },
            { key: 'Shift+? / Ctrl+K', label: 'Open Quick Command Palette' },
          ],
          tip: 'Tip: Stock up on supplies and bank your coins before taking the stairs down!',
        };
      }

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
            { key: 'Arrows / Numpad', label: 'Move 8 ways, bump to attack or open doors (W A D and H J K Y N move too)' },
            { key: 'Space / .', label: 'Wait a single turn (regenerates energy)' },
            { key: 'M', label: 'Explored Dungeon Map Viewer (0 turns)' },
            { key: 'X / L', label: 'Look / Inspect tiles and monster intents' },
            { key: 'Shift+G / Shift+,', label: 'Quick-Loot all items on ground tile' },
            { key: 'Z', label: 'Open Spellbook and cast known spells' },
            { key: 'I', label: 'Open Inventory, Paperdoll, and Containers' },
            { key: 'F', label: 'Context action: stairs, loot, doors, talk, or rest, as the console button shows' },
            { key: 'Shift+1-4', label: 'Drink a potion from the row beside the health orb' },
            { key: 'B', label: 'Open Bestiary' },
            { key: 'Shift+? / Ctrl+K', label: 'Open Quick Command Palette' },
            { key: 'R / S', label: 'Rest until healed (R) / Search for hidden traps (S)' },
            { key: '> / <', label: 'Climb stairs down (>) or climb stairs up (<)' },
            { key: 'Q', label: 'Save progress and return to character roster' },
          ],
          tip: 'Tip: Slay 15 of one creature, or many of its whole family, to earn a Mastery Perk against them. Review and change perks in the Bestiary [B].',
        };
    }
  }

  public open(
    engine: GameEngine,
    inventory?: OpenFlag,
    targetingOverlay?: TargetingOverlay,
    shopOverlay?: ShopDialog,
    inspectOverlay?: InspectOverlay,
    mapOverlay?: MapOverlay,
    onDismiss?: () => void
  ): void {
    if (!this.overlayEl) return;
    this.onDismissCallback = onDismiss;

    const context = this.detectContext(engine, inventory, targetingOverlay, shopOverlay, inspectOverlay, mapOverlay);
    this.render(this.getHelpContent(context, engine.manifest), engine.manifest?.name ?? '');
  }

  /**
   * The exploration guide outside a run (the title screen's Help), where no InputHandler
   * owns the keyboard: the card takes focus and closes itself on Esc or F1.
   */
  public openGuide(manifest?: GameContentManifest, onDismiss?: () => void): void {
    if (!this.overlayEl) return;
    this.onDismissCallback = onDismiss;
    this.render(this.getHelpContent('exploration', manifest), manifest?.name ?? '');
    const overlay = this.overlayEl;
    overlay.tabIndex = -1;
    const onKey = (e: KeyboardEvent): void => {
      if (e.code !== 'Escape' && e.code !== 'F1') return;
      e.preventDefault();
      e.stopPropagation();
      overlay.removeEventListener('keydown', onKey);
      this.close();
    };
    overlay.addEventListener('keydown', onKey);
    overlay.focus();
  }

  private render(content: HelpCardContent, packName: string): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = `
      <div class="retro-window" style="width: 380px; box-shadow: 0 8px 24px rgba(0,0,0,0.85); border: 1px solid var(--ui-accent, #f59e0b);">
        <div class="retro-titlebar" style="padding: 3px 6px; border-bottom-color: var(--ui-accent, #f59e0b);">
          <div class="retro-titlebar-title" style="font-size: 11px;">
            ${iconHtml('help')}
            <span>${content.title} (F1)</span>
          </div>
          <button id="btn-context-help-close" class="win-btn win-btn-sm" style="padding: 0 4px; font-weight: bold; line-height: 1;">✕</button>
        </div>
        <div class="retro-window-body" style="padding: 8px; font-size: 11px; background: var(--ui-panel, #161a26); color: var(--ui-text, #f1f5f9);">
          <div style="font-weight: bold; color: var(--ui-accent, #f59e0b); font-size: 10px; letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid var(--ui-border-light, #3b455b); padding-bottom: 2px;">
            ${content.contextTag}
          </div>
          <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px;">
            ${content.bullets
              .map(
                (b) => `
              <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 8px; background: rgba(255, 255, 255, 0.04); padding: 2px 4px; border: 1px solid var(--ui-border-light, #3b455b);">
                <span style="font-family: monospace; font-weight: bold; color: var(--ui-titlebar-text, #fde047); white-space: nowrap;">[${b.key}]</span>
                <span style="opacity: 0.8; text-align: right; font-size: 10px;">${b.label}</span>
              </div>
            `
              )
              .join('')}
          </div>
          <div style="font-size: 10px; color: #86efac; font-style: italic; background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(134, 239, 172, 0.4); padding: 4px; margin-bottom: 6px;">
            ${content.tip}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; opacity: 0.7; border-top: 1px solid var(--ui-border-light, #3b455b); padding-top: 4px;">
            <span>Move, Esc, or F1 to dismiss</span>
            <span style="color: var(--ui-accent, #f59e0b); font-weight: bold;">${packName}</span>
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
    inventory?: OpenFlag,
    targetingOverlay?: TargetingOverlay,
    shopOverlay?: ShopDialog,
    inspectOverlay?: InspectOverlay,
    mapOverlay?: MapOverlay,
    onDismiss?: () => void
  ): void {
    if (this.isOpenState) {
      this.close();
    } else {
      this.open(engine, inventory, targetingOverlay, shopOverlay, inspectOverlay, mapOverlay, onDismiss);
    }
  }
}
