import { type GameContentManifest, type GameEngine, TempleService, formatCurrency, isPrologueRunning } from '../../engine';
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

export type GameHelpContext =
  | 'exploration'
  | 'town'
  | 'inventory'
  | 'targeting'
  | 'inspect'
  | 'shop'
  | 'map'
  | 'altar'
  | 'story'
  | 'rune'
  | 'spellbook'
  | 'bestiary'
  | 'character'
  | 'pacts'
  | 'opening';

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
  private screenContext?: () => GameHelpContext | null;

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

  /**
   * The composition root's say on what the player is looking at, for screens this module
   * can't see (an altar's rite, the Story tab, the Rune of Return): checked first.
   */
  public setScreenContext(fn: () => GameHelpContext | null): void {
    this.screenContext = fn;
  }

  public detectContext(
    engine: GameEngine,
    inventory?: OpenFlag,
    targetingOverlay?: TargetingOverlay,
    shopOverlay?: ShopDialog,
    inspectOverlay?: InspectOverlay,
    mapOverlay?: MapOverlay
  ): GameHelpContext {
    const screen = this.screenContext?.();
    if (screen) return screen;
    if (mapOverlay?.isOpen) return 'map';
    if (shopOverlay?.isOpen) return 'shop';
    if (inspectOverlay?.isOpen) return 'inspect';
    if (targetingOverlay?.isOpen) return 'targeting';
    if (inventory?.isOpen) return 'inventory';
    // The prologue bars the town's services: not the town card's shop list.
    if (isPrologueRunning(engine.worldState, engine.manifest?.prologue)) return 'opening';
    if (engine.currentFloor === 0) return 'town';
    return 'exploration';
  }

  public getHelpContent(context: GameHelpContext, manifest?: GameContentManifest): HelpCardContent {
    switch (context) {
      case 'altar':
        return {
          title: 'Altars & Glyphs',
          contextTag: 'RITES OF THE GRIMOIRE',
          bullets: [
            { key: 'Step onto it', label: 'Begin the altar\'s rite; each altar works one, once' },
            { key: 'Click', label: 'Choose the offering to burn, then the slot or spell' },
            { key: 'Enter', label: 'Perform the rite (the offering is gone)' },
            { key: 'Esc', label: 'Step away; the altar waits for you' },
          ],
          tip: 'Tip: An inscribe rite turns the offering into a glyph on a grimoire slot, and the glyph shapes every spell cast from that slot. A ground rite opens a sealed slot instead; a forge rite transmutes a spell.',
        };

      case 'spellbook': {
        const grid = manifest?.magic?.grimoire;
        const center = grid?.centerSlotLabel ?? 'center';
        return {
          title: 'Spellbook & Grimoire',
          contextTag: 'THE GRIMOIRE',
          bullets: [
            { key: 'Up / Down', label: 'Choose a spell' },
            { key: 'Enter', label: 'Cast it' },
            { key: '1-0', label: 'Put it on the quick-cast belt; again to take it off' },
            ...(grid
              ? [
                  { key: 'Click a slot', label: 'Put the chosen spell there; a page holds one copy, so placing it again moves it' },
                  { key: 'Point at a slot', label: 'See what it does; a lit line joins slots that shape each other' },
                  { key: 'Page tabs', label: 'Turn the page: free with no foe in view, a 2-turn focus with one' },
                ]
              : []),
            { key: 'Tab / Z / Esc', label: 'The next tab, or close' },
          ],
          tip: grid
            ? `Tip: A spell casts from its slot on the open page. The ${center} slot makes it dearer and stronger for each filled slot beside it; opposed elements side by side, and a ray beside a burst, strengthen each other. With a foe in view, rewriting a slot takes a turn.`
            : 'Tip: The belt casts by key; the Spellbook shows what each spell costs and does.',
        };
      }

      case 'bestiary':
        return {
          title: 'Bestiary',
          contextTag: 'KNOW YOUR FOE',
          bullets: [
            { key: 'Up / Down', label: 'Choose a creature' },
            { key: 'Left / Right', label: 'All, discovered, or mastered' },
            { key: '? / Seen / Slain / Mastered', label: 'How much you know of it' },
            { key: 'Tab / B / Esc', label: 'The next tab, or close' },
          ],
          tip: manifest?.magic?.killRites
            ? 'Tip: Each one you slay teaches you more of its kind, and enough earns a mastery perk against it. Some give up their magic only when slain a certain way: the entry\'s verse hints how.'
            : 'Tip: Each one you slay teaches you more of its kind, and enough earns a mastery perk against it.',
        };

      case 'character':
        return {
          title: 'Character',
          contextTag: 'THE HERO',
          bullets: [
            { key: 'S / D / C / I', label: 'Plan a point in Strength, Dexterity, Constitution or Intelligence' },
            { key: 'Shift+S / D / C / I', label: 'Take a planned point back' },
            { key: 'Z / Shift+Z', label: 'Undo, redo' },
            { key: 'R', label: 'Clear the plan' },
            { key: 'Enter', label: 'Spend the planned points' },
            { key: '1 / 2 / 3', label: 'Rune of Return ranks, once you carry one' },
          ],
          tip: 'Tip: Points are spent only when you accept the plan; closing keeps them for later.',
        };

      case 'pacts': {
        const keeperId = manifest?.pactKeeperNpcId;
        const keeper = keeperId ? manifest?.town?.npcs?.find((n) => n.id === keeperId)?.name ?? 'The pact keeper' : null;
        return {
          title: 'Pacts',
          contextTag: 'BARGAINS',
          bullets: [
            { key: 'Up / Down', label: 'Choose a pact: its curse and its reward' },
            keeper ? { key: keeper, label: 'Seals and renounces pacts, in town' } : { key: 'Enter', label: 'Seal the pact, or renounce it' },
            { key: 'Tab / P / Esc', label: 'The next tab, or close' },
          ],
          tip: 'Tip: A pact is a curse you carry for a reward. It holds until you renounce it.',
        };
      }

      case 'story':
        return {
          title: 'Story',
          contextTag: 'THE SAGA',
          bullets: [
            { key: 'Left / Right', label: 'The saga, or lore and standing' },
            { key: 'Tab', label: 'The next tab of the character menu' },
            { key: 'O / Esc', label: 'Close the Story' },
          ],
          tip: 'Tip: Deeds still to come show as riddles, and a deed done since you last looked glows once. Standing shows how each faction you have met regards you.',
        };

      case 'rune':
        return {
          title: 'Rune of Return',
          contextTag: 'THE WAY HOME',
          bullets: [
            { key: 'T', label: 'Channel the rune: keep still and it carries you to town' },
            { key: 'Moving, attacking', label: 'Breaks the channel; waiting keeps it going' },
            { key: 'Shift+T', label: 'Rune mastery: spend points on its ranks' },
            { key: resolveBranding(manifest).runeSmithName, label: 'Awakens a dormant rune and refills its charges' },
          ],
          tip: 'Tip: Channel before a fight turns bad, not during it: any wound you take while channeling breaks it.',
        };

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
            { key: 'Arrows / Numpad', label: 'Move the aim to a target' },
            { key: 'Enter / Space', label: 'Cast at the aim' },
            { key: 'Esc', label: `Cancel; no ${resolveBranding(manifest).manaName} is spent` },
          ],
          tip: 'Tip: Elemental spells deal bonus damage against monsters weak to fire, cold, or lightning.',
        };

      case 'inventory':
        return {
          title: 'Inventory & Paperdoll Equipment',
          contextTag: 'EQUIPMENT MANAGEMENT',
          bullets: [
            { key: 'Arrows', label: 'Choose an item; Tab moves to the next panel' },
            { key: 'Enter', label: 'Use the chosen item (drink, read, open)' },
            { key: 'E', label: 'Equip or take off the chosen item' },
            { key: 'D / T', label: 'Drop it, or take it from the ground' },
            { key: 'S', label: 'Sort the pack by the next order' },
            { key: 'C', label: 'Move loose coins into the purse' },
            { key: 'I / Esc', label: 'Close the inventory' },
          ],
          tip: 'Tip: Click items to examine stats, enchanted +X bonuses, and elemental burst affixes.',
        };

      case 'opening':
        // The pack's prologue: the town's services are barred, so the card has the keys
        // that matter in a fight instead of its shops.
        return {
          title: manifest?.town?.name ?? 'Town',
          contextTag: 'THE OPENING',
          bullets: [
            { key: 'Arrows / Numpad', label: 'Move 8 ways; bump to attack' },
            { key: 'Space / .', label: 'Wait a turn' },
            { key: '1-0', label: 'Cast the spell in that quick slot' },
            { key: 'Shift+1-4', label: 'Drink from the potion row' },
            { key: 'F', label: 'The action on the console button' },
            { key: 'X / L', label: 'Look at tiles and monster intents' },
            { key: 'Esc', label: 'Menu: settings, save, exit' },
          ],
          tip: 'Tip: The doors are barred and the townsfolk hidden until this is over. The line under your spells says where to go, and a glowing slot is the move the moment calls for.',
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
            { key: 'Arrows / Numpad', label: 'Move 8 ways; bump to attack or open' },
            { key: 'Space / .', label: 'Wait a turn' },
            { key: '1-0', label: 'Cast the spell in that quick slot' },
            { key: 'M', label: 'Map of explored floors (free)' },
            { key: 'Shift+M', label: "The log's history: every recent line (free)" },
            { key: 'X / L', label: 'Look at tiles and monster intents' },
            { key: 'Z', label: 'Spellbook: choose and cast' },
            { key: 'I', label: 'Inventory and equipment' },
            { key: 'E / O / P / B', label: 'Character, Story, Pacts, Bestiary' },
            { key: 'G / Shift+G', label: 'Pick up an item / everything here' },
            { key: 'T', label: 'Rune of Return: channel it home' },
            ...(manifest?.companions?.length
              ? [{ key: 'Shift+C / Shift+R', label: 'Call or send away your companion / its skill' }]
              : []),
            { key: 'F', label: 'The action on the console button' },
            { key: 'Shift+1-4', label: 'Drink from the potion row' },
            { key: 'Shift+? / Ctrl+K', label: 'Open the command palette' },
            { key: 'R / S / C', label: 'Rest / Search for secrets / Close door' },
            { key: '> / <', label: 'Take the stairs down / up' },
            { key: 'Esc / Q', label: 'Menu: settings, save, exit' },
            { key: 'Mouse', label: 'Click a distant tile to walk there; point at anything to see it' },
            { key: 'F3', label: 'Report a bug or suggest an idea' },
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
