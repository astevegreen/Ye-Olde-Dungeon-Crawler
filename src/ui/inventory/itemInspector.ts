import { resolveManaTerms } from '../../engine';
import type { GameEngine } from '../../engine';
import { Player } from '../../engine';
import { Item, type EquipmentSlot } from '../../engine';
import { Container } from '../../engine';
import { PotionItem, ScrollItem, WandItem } from '../../engine';
import { RuneOfReturnItem, ChannelRuneOfReturnAction } from '../../engine';
import { getSpell, getOverflowConfig } from '../../engine';
import type { Paperdoll } from '../../engine';
import { resolveBranding } from '../branding';

/** Engine spell id both the Identify scroll and spell cast (`spellPipeline.ts`'s `identify` effect). */
const IDENTIFY_SPELL_ID = 'identify';

export type InspectorSource = 'paperdoll' | 'backpack' | 'ground' | 'container' | 'companion' | 'none';
export type FocusedPanel = 'paperdoll' | 'backpack' | 'ground' | 'inspector';
export type ItemInspectorActionId = 'equip' | 'unequip' | 'use' | 'drop' | 'take' | 'put' | 'peek' | 'identify';

export interface EquipmentComparison {
  equippedItem: Item;
  slotName: string;
  attackDelta: number;
  defenseDelta: number;
  speedDelta: number;
  strengthDelta: number;
  weightDelta: number;
}

export interface ItemInspectorActionButton {
  id: ItemInspectorActionId;
  label: string;
  shortcut?: string;
  enabled: boolean;
  reason?: string;
  execute: (engine: GameEngine) => void;
}

export interface ItemBreakdown {
  displayName: string;
  identified: boolean;
  category: string;
  tier?: number;
  quality: string;
  isEnchanted: boolean;
  isCursed: boolean;
  enchantmentLevel: number;
  slotCompatibility: string[];
  stats: {
    attackBonus?: number;
    defenseBonus?: number;
    strengthBonus?: number;
    speedBonus?: number;
  };
  elementalAffix?: {
    name: string;
    element: string;
    bonusDamage: number;
  };
  weight: number;
  bulk: number;
  value: number;
  description: string;
  source: InspectorSource;
  slotId?: string;
  isContainer?: boolean;
}

export class ItemInspector {
  public selectedItem: Item | null = null;
  public selectedSource: InspectorSource = 'none';
  public selectedSlot?: string;
  public selectedContainer: Container | null = null;
  public focusedPanel: FocusedPanel = 'paperdoll';
  public focusedIndex: number = 0;
  public selectedItemIds: Set<string> = new Set();
  /** Opens a container an "Open" action names; without it the container is only remembered. */
  public onPeek?: (container: Container) => void;

  private peek(container: Container): void {
    if (this.onPeek) this.onPeek(container);
    else this.selectedContainer = container;
    this.clearSelection();
  }

  public toggleMultiSelect(item: Item): void {
    if (this.selectedItemIds.has(item.id)) {
      this.selectedItemIds.delete(item.id);
    } else {
      this.selectedItemIds.add(item.id);
    }
  }

  public clearMultiSelect(): void {
    this.selectedItemIds.clear();
  }

  public isMultiSelected(itemId: string): boolean {
    return this.selectedItemIds.has(itemId);
  }

  /**
   * Updates selection to a specific item from a specific source panel.
   */
  public select(
    item: Item | null,
    source: InspectorSource,
    slotId?: string,
    container?: Container | null
  ): void {
    this.selectedItem = item;
    this.selectedSource = item ? source : 'none';
    this.selectedSlot = slotId;
    if (container !== undefined) {
      this.selectedContainer = container;
    }
  }

  /**
   * Resets selection to unselected state (showing player aggregate stats).
   */
  public clearSelection(): void {
    this.selectedItem = null;
    this.selectedSource = 'none';
    this.selectedSlot = undefined;
    this.selectedItemIds.clear();
  }

  /**
   * Switches keyboard focus to a given panel.
   */
  public setFocus(panel: FocusedPanel, index: number = 0): void {
    this.focusedPanel = panel;
    this.focusedIndex = Math.max(0, index);
  }

  /**
   * Cycles focus through panels: paperdoll -> backpack -> ground -> inspector -> paperdoll.
   */
  /** True when one more step in this direction would wrap: the last panel going
   *  forward, the first going back. */
  public atPanelEdge(forward: boolean): boolean {
    const panels: FocusedPanel[] = ['paperdoll', 'backpack', 'ground', 'inspector'];
    const curIdx = panels.indexOf(this.focusedPanel);
    return forward ? curIdx === panels.length - 1 : curIdx === 0;
  }

  public cyclePanel(forward: boolean = true): FocusedPanel {
    const panels: FocusedPanel[] = ['paperdoll', 'backpack', 'ground', 'inspector'];
    const curIdx = panels.indexOf(this.focusedPanel);
    const nextIdx = forward
      ? (curIdx + 1) % panels.length
      : (curIdx - 1 + panels.length) % panels.length;
    this.focusedPanel = panels[nextIdx];
    this.focusedIndex = 0;
    return this.focusedPanel;
  }

  /**
   * Compiles detailed breakdown of the selected item.
   */
  public getItemBreakdown(
    item: Item,
    source: InspectorSource,
    slotId?: string,
    doll?: Paperdoll
  ): ItemBreakdown {
    const isIdentified = item.identified;
    const isEnchanted = isIdentified && ((item.enchantmentLevel && item.enchantmentLevel > 0) || !!item.elementalAffix);
    const isCursed = isIdentified && item.isBound();

    const compatibleSlots: string[] = [];
    // An item that names its slot goes there and nowhere else (Paperdoll.canEquip);
    // only one that doesn't fits any slot taking its category.
    const ownSlot = item.slot && doll ? doll.getSlotDefinition(item.slot) : undefined;
    if (ownSlot) {
      compatibleSlots.push(ownSlot.name);
    } else if (doll) {
      for (const slotDef of doll.getSlotDefinitions()) {
        if (slotDef.acceptedCategories.includes(item.category)) {
          compatibleSlots.push(slotDef.name);
        }
      }
    } else if (item.slot) {
      compatibleSlots.push(item.slot);
    }

    return {
      displayName: item.displayName,
      identified: isIdentified,
      category: item.category ?? 'item',
      tier: isIdentified ? item.tier : undefined,
      quality: isIdentified ? item.quality : 'normal',
      isEnchanted: Boolean(isEnchanted),
      isCursed,
      enchantmentLevel: isIdentified ? (item.enchantmentLevel ?? 0) : 0,
      slotCompatibility: compatibleSlots,
      stats: isIdentified
        ? {
            attackBonus: item.stats.attackBonus,
            defenseBonus: item.stats.defenseBonus,
            strengthBonus: item.stats.strengthBonus,
            speedBonus: item.stats.speedBonus,
          }
        : {},
      elementalAffix:
        isIdentified && item.elementalAffix
          ? {
              name: item.elementalAffix.name,
              element: item.elementalAffix.element,
              bonusDamage: item.elementalAffix.bonusDamage,
            }
          : undefined,
      weight: item.weight,
      bulk: item.bulk,
      // The guess is of the plain item: a hidden +N must not show in it.
      value: isIdentified ? (item.value ?? 0) : Math.floor(item.baseValue * 0.25),
      description: isIdentified
        ? item.description || 'No lore description available.'
        : 'An unidentified item. Its magical properties, enchantments, and curses remain shrouded in mystery until inspected or used.',
      source,
      slotId,
      isContainer: item instanceof Container,
    };
  }

  /**
   * Compares the selected item against whatever is currently equipped in its compatible slot.
   */
  public getEquipmentComparison(item: Item, player: Player): EquipmentComparison | null {
    if (!item.identified) return null;
    const doll = player.inventory.paperdoll;
    for (const slotDef of doll.getSlotDefinitions()) {
      if (slotDef.acceptedCategories.includes(item.category) || (item.slot && slotDef.id === item.slot)) {
        const equipped = doll.getItem(slotDef.id);
        if (equipped && equipped.id !== item.id) {
          const itemAtk = item.stats.attackBonus ?? 0;
          const eqAtk = equipped.stats.attackBonus ?? 0;
          const itemDef = item.stats.defenseBonus ?? 0;
          const eqDef = equipped.stats.defenseBonus ?? 0;
          const itemSpd = item.stats.speedBonus ?? 0;
          const eqSpd = equipped.stats.speedBonus ?? 0;
          const itemStr = item.stats.strengthBonus ?? 0;
          const eqStr = equipped.stats.strengthBonus ?? 0;
          const itemWt = item.weight;
          const eqWt = equipped.weight;

          return {
            equippedItem: equipped,
            slotName: slotDef.name,
            attackDelta: itemAtk - eqAtk,
            defenseDelta: itemDef - eqDef,
            speedDelta: itemSpd - eqSpd,
            strengthDelta: itemStr - eqStr,
            weightDelta: itemWt - eqWt,
          };
        }
      }
    }
    return null;
  }

  /** What would identify an item right now: a known Scroll of Identify, else the Identify
   * spell if the player knows it and can pay its mana. */
  private findIdentifySource(
    player: Player,
    engine?: GameEngine
  ): { label: string; enabled: boolean; reason?: string; dispatch: (engine: GameEngine, itemId: string) => void } | null {
    const scroll = player.inventory
      .getAllCarriedItems()
      .find((i): i is ScrollItem => i instanceof ScrollItem && i.spellId === IDENTIFY_SPELL_ID && i.identified);
    if (scroll) {
      return {
        label: 'reads a scroll',
        enabled: true,
        dispatch: (eng, itemId) =>
          eng.commandBus.dispatch({ type: 'read_scroll', payload: { itemId: scroll.id, itemTargetId: itemId } }),
      };
    }
    if (player.spellsKnown.includes(IDENTIFY_SPELL_ID)) {
      const spell = engine?.manifest?.spells?.find((s) => s.id === IDENTIFY_SPELL_ID) ?? getSpell(IDENTIFY_SPELL_ID);
      let manaDiscount = 0;
      if (player.inventory?.paperdoll) {
        for (const it of player.inventory.paperdoll.getEquippedItems()) {
          for (const mod of it.modifiers) {
            if (mod.manaCostDiscount) manaDiscount += mod.manaCostDiscount;
          }
        }
      }
      const cost = Math.max(0, (spell?.manaCost ?? 8) - manaDiscount);
      const overflow = engine ? getOverflowConfig(engine) : undefined;
      if (player.mana < cost && !overflow) {
        return {
          label: 'casts the spell',
          enabled: false,
          reason: `Not enough ${resolveManaTerms(engine?.manifest).name} to cast Identify (Requires ${cost} ${resolveManaTerms(engine?.manifest).unit}, have ${player.mana})`,
          dispatch: () => {},
        };
      }
      return {
        label: player.mana < cost && overflow ? `overcasts the spell (${overflow.debtName})` : 'casts the spell',
        enabled: true,
        dispatch: (eng, itemId) =>
          eng.commandBus.dispatch({
            type: 'cast_spell',
            payload: { spellId: IDENTIFY_SPELL_ID, targetX: player.x, targetY: player.y, itemTargetId: itemId },
          }),
      };
    }
    return null;
  }

  /**
   * Generates context-sensitive action buttons based on item type and location.
   */
  public getAvailableActions(engine: GameEngine): ItemInspectorActionButton[] {
    const actions: ItemInspectorActionButton[] = [];

    // Batch actions when multiple items are selected
    if (this.selectedItemIds.size > 1) {
      const selectedCount = this.selectedItemIds.size;
      actions.push({
        id: 'drop',
        label: `Drop Selected (${selectedCount}) [D]`,
        shortcut: 'D',
        enabled: true,
        execute: (eng) => {
          const itemsToDrop = eng.player.inventory.primaryPack
            .getItems()
            .filter((i) => this.selectedItemIds.has(i.id));
          for (const it of itemsToDrop) {
            eng.commandBus.dispatch({ type: 'drop_item', payload: { item: it, source: 'pack' } });
          }
          this.clearMultiSelect();
          this.clearSelection();
        },
      });

      if (this.selectedContainer) {
        actions.push({
          id: 'put',
          label: `Move Selected (${selectedCount}) [P]`,
          shortcut: 'P',
          enabled: true,
          execute: (eng) => {
            if (this.selectedContainer) {
              const itemsToMove = eng.player.inventory.primaryPack
                .getItems()
                .filter((i) => this.selectedItemIds.has(i.id));
              for (const it of itemsToMove) {
                eng.commandBus.dispatch({
                  type: 'store_container',
                  payload: { container: this.selectedContainer, item: it },
                });
              }
              this.clearMultiSelect();
              this.clearSelection();
            }
          },
        });
      }

      return actions;
    }

    if (!this.selectedItem) return actions;

    const player = engine.player;
    const item = this.selectedItem;
    const source = this.selectedSource;
    const slotId = this.selectedSlot;

    // Identify an unidentified carried item in place: a known Scroll of Identify first,
    // else the Identify spell. Both target this exact item (itemTargetId).
    if (!item.identified && (source === 'paperdoll' || source === 'backpack' || source === 'container')) {
      const identifySource = this.findIdentifySource(player, engine);
      actions.push({
        id: 'identify',
        label: identifySource ? `Identify (Y) — ${identifySource.label}` : 'Identify (Y)',
        shortcut: 'Y',
        enabled: identifySource?.enabled ?? false,
        reason: identifySource?.reason ?? (identifySource ? undefined : 'Needs a Scroll of Identify or the Identify spell'),
        execute: (eng) => {
          if (identifySource?.enabled) {
            identifySource.dispatch(eng, item.id);
            this.clearSelection();
          }
        },
      });
    }

    // 1. Paperdoll item actions
    if (source === 'paperdoll' && slotId) {
      if (item instanceof Container) {
        actions.push({
          id: 'peek',
          label: 'Open Container (Enter)',
          shortcut: 'Enter',
          enabled: true,
          execute: () => {
            this.peek(item);
          },
        });
      }

      const canUnequip = player.inventory.paperdoll.canUnequip(slotId as EquipmentSlot);
      actions.push({
        id: 'unequip',
        label: 'Unequip (E)',
        shortcut: 'E',
        enabled: canUnequip.allowed,
        reason: canUnequip.reason,
        execute: (eng) => {
          eng.commandBus.dispatch({ type: 'unequip_item', payload: { slot: slotId } });
          this.clearSelection();
        },
      });

      actions.push({
        id: 'drop',
        label: 'Drop (D)',
        shortcut: 'D',
        enabled: canUnequip.allowed,
        reason: canUnequip.reason,
        execute: (eng) => {
          eng.commandBus.dispatch({
            type: 'drop_item',
            payload: { item, source: 'paperdoll', slot: slotId as EquipmentSlot },
          });
          this.clearSelection();
        },
      });
      return actions;
    }

    // 2. Backpack item actions
    if (source === 'backpack') {
      if (item instanceof Container) {
        actions.push({
          id: 'peek',
          label: 'Open Container (Enter)',
          shortcut: 'Enter',
          enabled: true,
          execute: () => {
            this.peek(item);
          },
        });
      }

      // Check if equippable
      // Offer Equip for anything some slot accepts (disabled, with the reason, when it
      // can't go on right now); never for a scroll or a potion.
      const canEquipResult = player.inventory.paperdoll.canEquip(item);
      const isEquippable = player.inventory.paperdoll
        .getSlotDefinitions()
        .some((def) => def.acceptedCategories.includes(item.category) || (item.slot !== undefined && def.id === item.slot));
      if (isEquippable) {
        actions.push({
          id: 'equip',
          label: 'Equip (E)',
          shortcut: 'E',
          enabled: canEquipResult.allowed,
          reason: canEquipResult.reason,
          execute: (eng) => {
            eng.commandBus.dispatch({ type: 'equip_item', payload: { itemId: item.id } });
            this.clearSelection();
          },
        });
      }

      // Check if consumable
      if (item instanceof PotionItem) {
        actions.push({
          id: 'use',
          label: 'Drink (U)',
          shortcut: 'U',
          enabled: true,
          execute: (eng) => {
            eng.commandBus.dispatch({ type: 'drink_potion', payload: { itemId: item.id } });
            this.clearSelection();
          },
        });
      } else if (item instanceof ScrollItem) {
        actions.push({
          id: 'use',
          label: 'Read (U)',
          shortcut: 'U',
          enabled: true,
          execute: (eng) => {
            eng.commandBus.dispatch({ type: 'read_scroll', payload: { itemId: item.id } });
            this.clearSelection();
          },
        });
      } else if (item instanceof WandItem) {
        actions.push({
          id: 'use',
          label: 'Zap (U)',
          shortcut: 'U',
          enabled: item.canZap(),
          reason: item.canZap() ? undefined : 'No charges remaining.',
          execute: (eng) => {
            eng.commandBus.dispatch({ type: 'zap_wand', payload: { itemId: item.id } });
            this.clearSelection();
          },
        });
      } else if (item instanceof RuneOfReturnItem) {
        actions.push({
          id: 'use',
          label: `Channel (${item.charges}/${item.maxCharges}) [T]`,
          shortcut: 'T',
          enabled: item.charges > 0,
          reason: item.charges <= 0 ? `No charges remaining (refill freely at ${resolveBranding(engine.manifest).runeSmithName} in town).` : undefined,
          execute: (eng) => {
            eng.handlePlayerAction(new ChannelRuneOfReturnAction(eng.player));
            this.clearSelection();
          },
        });
        actions.push({
          id: 'use',
          label: 'Mastery Tree [M]',
          shortcut: 'M',
          enabled: true,
          execute: () => {
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('open_rune_of_return_tree'));
            }
          },
        });
      }

      // Store in ground container if open
      if (this.selectedContainer) {
        const canStore = this.selectedContainer.canContain(item);
        actions.push({
          id: 'put',
          label: 'Put in Chest (P)',
          shortcut: 'P',
          enabled: canStore.allowed,
          reason: canStore.reason,
          execute: (eng) => {
            if (this.selectedContainer) {
              eng.commandBus.dispatch({
                type: 'store_container',
                payload: { container: this.selectedContainer, item },
              });
              this.clearSelection();
            }
          },
        });
      }

      // Drop
      actions.push({
        id: 'drop',
        label: 'Drop (D)',
        shortcut: 'D',
        enabled: true,
        execute: (eng) => {
          eng.commandBus.dispatch({ type: 'drop_item', payload: { item, source: 'pack' } });
          this.clearSelection();
        },
      });

      return actions;
    }

    // 3. Ground item actions
    if (source === 'ground') {
      if (item instanceof Container) {
        actions.push({
          id: 'peek',
          label: 'Open Chest (Enter)',
          shortcut: 'Enter',
          enabled: true,
          execute: () => {
            this.peek(item);
          },
        });
      }

      actions.push({
        id: 'take',
        label: 'Pick Up (T)',
        shortcut: 'T',
        enabled: true,
        execute: (eng) => {
          eng.commandBus.dispatch({ type: 'pickup_item', payload: { itemId: item.id } });
          this.clearSelection();
        },
      });
      return actions;
    }

    // 4. The companion's pack: take it back
    if (source === 'companion') {
      actions.push({
        id: 'take',
        label: 'Take back (T)',
        shortcut: 'T',
        enabled: true,
        execute: (eng) => {
          eng.commandBus.dispatch({ type: 'transfer_from_companion', payload: { itemId: item.id } });
          this.clearSelection();
        },
      });
      return actions;
    }

    // 5. Ground container item actions
    if (source === 'container' && this.selectedContainer) {
      actions.push({
        id: 'take',
        label: 'Take Item (T)',
        shortcut: 'T',
        enabled: true,
        execute: (eng) => {
          if (this.selectedContainer) {
            eng.commandBus.dispatch({
              type: 'loot_container',
              payload: { container: this.selectedContainer, item },
            });
            this.clearSelection();
          }
        },
      });
      return actions;
    }

    return actions;
  }

  /**
   * Executes the default/primary action for the currently selected item.
   */
  public executePrimaryAction(engine: GameEngine): boolean {
    const actions = this.getAvailableActions(engine);
    const primary = actions.find((a) => a.enabled);
    if (primary) {
      primary.execute(engine);
      return true;
    }
    return false;
  }
}
