import { type GameContentManifest, type GameEngine, TempleService, formatCurrency } from '../../engine';
import { dialogHtml } from '../dialog';
import { escapeHtml } from '../html';
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
      // A card in the top-right corner, above every menu and dialog (dialog.css .fh-overlay),
      // so F1 help is readable wherever it opens; play goes on beside it.
      overlay.className = 'fh-overlay';
      overlay.style.display = 'none';
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
            { key: 'S', label: 'Cycle backpack sorting (Category -> Weight -> Bulk)' },
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
            ...npcs.map((npc) => {
              const label = TOWN_ROLE_HELP[npc.role] ?? 'Talk by bumping into them';
              return { key: npc.name, label: npc.id === manifest?.pactKeeperNpcId ? `${label}; seal or renounce pacts` : label };
            }),
            { key: 'B', label: 'Open Bestiary' },
            { key: 'Shift+? / Ctrl+K', label: 'Open the command palette' },
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
            { key: 'Shift+? / Ctrl+K', label: 'Open the command palette' },
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
    this.render(this.getHelpContent(context, engine.manifest));
  }

  /**
   * The exploration guide outside a run (the title screen's Help), where no InputHandler
   * owns the keyboard: the card takes focus and closes itself on Esc or F1.
   */
  public openGuide(manifest?: GameContentManifest, onDismiss?: () => void): void {
    if (!this.overlayEl) return;
    this.onDismissCallback = onDismiss;
    this.render(this.getHelpContent('exploration', manifest));
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

  private render(content: HelpCardContent): void {
    if (!this.overlayEl) return;
    this.overlayEl.innerHTML = dialogHtml({
      title: content.title,
      kicker: content.contextTag,
      icon: 'help',
      closeId: 'btn-context-help-close',
      closeTitle: 'Close (F1)',
      body: `
        <div class="fh-keys">
          ${content.bullets
            .map((b) => `<div class="fh-row"><span class="fh-key">${escapeHtml(b.key)}</span><span class="fh-label">${escapeHtml(b.label)}</span></div>`)
            .join('')}
        </div>
        <div class="ui-fact">${escapeHtml(content.tip)}</div>`,
      footNote: '<span>Move, Esc or F1 to close</span>',
    });

    this.overlayEl.querySelector('#btn-context-help-close')?.addEventListener('click', () => {
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
