import type { GameEngine } from '../../engine';
import { Player } from '../../engine';
import { Item, type EquipmentSlot } from '../../engine';
import { Container } from '../../engine';
import { PotionItem, ScrollItem, WandItem } from '../../engine';
import { RuneOfReturnItem, ChannelRuneOfReturnAction } from '../../engine';
import { EncumbranceLevel } from '../../engine';
import type { Paperdoll } from '../../engine';
import type { ThemeTokens } from '../../engine';

/** Engine spell id both the Identify scroll and spell cast (`spellPipeline.ts`'s `identify` effect). */
const IDENTIFY_SPELL_ID = 'identify';

export type InspectorSource = 'paperdoll' | 'backpack' | 'ground' | 'container' | 'none';
export type FocusedPanel = 'paperdoll' | 'backpack' | 'ground' | 'inspector';
export type ItemInspectorActionId = 'equip' | 'unequip' | 'use' | 'drop' | 'take' | 'put' | 'peek' | 'identify';

export interface ItemInspectorActionButton {
  id: ItemInspectorActionId;
  label: string;
  shortcut?: string;
  enabled: boolean;
  reason?: string;
  execute: (engine: GameEngine) => void;
}

export interface AggregatePlayerStats {
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  totalAttack: number;
  baseAttack: number;
  equipmentAttackBonus: number;
  totalDefense: number;
  baseDefense: number;
  equipmentDefenseBonus: number;
  strength: number;
  intelligence: number;
  constitution: number;
  dexterity: number;
  speed: number;
  carryWeight: number;
  maxCarryWeight: number;
  weightRatio: number;
  packBulk: number;
  maxPackBulk: number;
  encumbranceLevel: EncumbranceLevel;
  encumbranceMultiplier: number;
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
   * Computes aggregate player stats for unselected overview state.
   */
  public getAggregateStats(player: Player): AggregatePlayerStats {
    const inv = player.inventory;
    const doll = inv.paperdoll;
    const totalWeight = inv.totalWeight();
    const maxWeight = player.strength * 2500;
    const weightRatio = Math.min(1.0, maxWeight > 0 ? totalWeight / maxWeight : 0);
    const encLevel = inv.getEncumbrance(player.strength);
    const encMultiplier = inv.getEncumbranceMultiplier(player.strength);
    const packBulk = inv.primaryPack.containedBulk();
    const maxBulk = inv.primaryPack.maxBulkCapacity;

    const stats = doll.calculateStats();
    const eqAtk = stats.attackBonus;
    const eqDef = stats.defenseBonus;

    return {
      name: player.name,
      level: player.level,
      hp: player.hp,
      maxHp: player.maxHp,
      mana: player.mana,
      maxMana: player.maxMana,
      totalAttack: player.attack,
      baseAttack: player.attack - eqAtk,
      equipmentAttackBonus: eqAtk,
      totalDefense: player.defense,
      baseDefense: player.defense - eqDef,
      equipmentDefenseBonus: eqDef,
      strength: player.strength,
      intelligence: player.intelligence,
      constitution: player.constitution,
      dexterity: player.dexterity,
      speed: player.speed,
      carryWeight: totalWeight,
      maxCarryWeight: maxWeight,
      weightRatio,
      packBulk,
      maxPackBulk: maxBulk,
      encumbranceLevel: encLevel,
      encumbranceMultiplier: Math.round(encMultiplier * 100),
    };
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
    const isCursed = isIdentified && item.isCursed();

    const compatibleSlots: string[] = [];
    if (doll) {
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
      value: isIdentified ? (item.value ?? 0) : Math.floor((item.value ?? 0) * 0.25),
      description: isIdentified
        ? item.description || 'No lore description available.'
        : 'An unidentified item. Its magical properties, enchantments, and curses remain shrouded in mystery until inspected or used.',
      source,
      slotId,
      isContainer: item instanceof Container,
    };
  }

  /** What would identify an item right now: a known Scroll of Identify, else the Identify
   * spell if the player knows it and can pay its mana. */
  private findIdentifySource(
    player: Player
  ): { label: string; dispatch: (engine: GameEngine, itemId: string) => void } | null {
    const scroll = player.inventory
      .getAllCarriedItems()
      .find((i): i is ScrollItem => i instanceof ScrollItem && i.spellId === IDENTIFY_SPELL_ID && i.identified);
    if (scroll) {
      return {
        label: 'reads a scroll',
        dispatch: (engine, itemId) =>
          engine.commandBus.dispatch({ type: 'read_scroll', payload: { itemId: scroll.id, itemTargetId: itemId } }),
      };
    }
    if (player.spellsKnown.includes(IDENTIFY_SPELL_ID)) {
      return {
        label: 'casts the spell',
        dispatch: (engine, itemId) =>
          engine.commandBus.dispatch({
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
    if (!item.identified && (source === 'paperdoll' || source === 'backpack')) {
      const identifySource = this.findIdentifySource(player);
      actions.push({
        id: 'identify',
        label: identifySource ? `Identify (Y) — ${identifySource.label}` : 'Identify (Y)',
        shortcut: 'Y',
        enabled: identifySource !== null,
        reason: identifySource ? undefined : 'Needs a Scroll of Identify or the Identify spell',
        execute: (eng) => {
          identifySource?.dispatch(eng, item.id);
          this.clearSelection();
        },
      });
    }

    // 1. Paperdoll item actions
    if (source === 'paperdoll' && slotId) {
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
            this.selectedContainer = item;
            this.clearSelection();
          },
        });
      }

      // Check if equippable
      const canEquipResult = player.inventory.paperdoll.canEquip(item);
      const isEquippable = canEquipResult.allowed || canEquipResult.reason !== 'Item cannot be equipped in that slot.';
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
          reason: item.charges <= 0 ? 'No charges remaining (refill freely at Thrain in town).' : undefined,
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
            this.selectedContainer = item;
            this.clearSelection();
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

    // 4. Ground container item actions
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

  /**
   * Renders the stationary Item Inspector panel into the given canvas bounding box.
   */
  public renderPane(
    ctx: CanvasRenderingContext2D,
    engine: GameEngine,
    x: number,
    y: number,
    w: number,
    h: number,
    theme: Required<ThemeTokens>,
    registerClickZone?: (x: number, y: number, w: number, h: number, action: () => void) => void
  ): void {
    const font = theme.fontFamily ?? '"Courier New", Courier, monospace';

    // Panel Background and border
    ctx.fillStyle = theme.cardBg;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = this.focusedPanel === 'inspector' ? theme.hudAccent : theme.cardBorder;
    ctx.lineWidth = this.focusedPanel === 'inspector' ? 2 : 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Header bar
    ctx.fillStyle = theme.modalTitlebar;
    ctx.fillRect(x, y, w, 24);
    ctx.strokeStyle = theme.cardBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 24.5);
    ctx.lineTo(x + w, y + 24.5);
    ctx.stroke();

    ctx.font = `bold 11px ${font}`;
    ctx.fillStyle = theme.hudAccent;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      this.selectedItem ? 'ITEM INSPECTOR' : 'CHARACTER ATTRIBUTES',
      x + 8,
      y + 12
    );

    let curY = y + 36;
    const padding = 10;
    const innerX = x + padding;
    const innerW = w - padding * 2;

    if (!this.selectedItem) {
      // ── Unselected State: Aggregate Player Stats ──
      const stats = this.getAggregateStats(engine.player);

      ctx.font = `bold 12px ${font}`;
      ctx.fillStyle = theme.hudText;
      ctx.fillText(`${stats.name} (Lvl ${stats.level})`, innerX, curY);
      curY += 18;

      ctx.font = `10px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`HP: ${stats.hp} / ${stats.maxHp}  |  MP: ${stats.mana} / ${stats.maxMana}`, innerX, curY);
      curY += 20;

      // Divider
      ctx.strokeStyle = theme.borderDark;
      ctx.beginPath();
      ctx.moveTo(innerX, curY);
      ctx.lineTo(innerX + innerW, curY);
      ctx.stroke();
      curY += 12;

      // Combat Ratings
      ctx.font = `bold 10px ${font}`;
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`Attack Rating: ${stats.totalAttack}`, innerX, curY);
      ctx.font = `9px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`(Base ${stats.baseAttack}, Gear +${stats.equipmentAttackBonus})`, innerX + 112, curY);
      curY += 16;

      ctx.font = `bold 10px ${font}`;
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`Armor Class: ${stats.totalDefense}`, innerX, curY);
      ctx.font = `9px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`(Base ${stats.baseDefense}, Gear +${stats.equipmentDefenseBonus})`, innerX + 112, curY);
      curY += 20;

      // Divider
      ctx.strokeStyle = theme.borderDark;
      ctx.beginPath();
      ctx.moveTo(innerX, curY);
      ctx.lineTo(innerX + innerW, curY);
      ctx.stroke();
      curY += 12;

      // Core Attributes
      ctx.font = `bold 10px ${font}`;
      ctx.fillStyle = theme.hudAccent;
      ctx.fillText('CORE ATTRIBUTES:', innerX, curY);
      curY += 16;

      const attrs = [
        { name: 'Strength (STR)', val: stats.strength },
        { name: 'Intelligence (INT)', val: stats.intelligence },
        { name: 'Constitution (CON)', val: stats.constitution },
        { name: 'Dexterity (DEX)', val: stats.dexterity },
        { name: 'Base Speed', val: stats.speed },
      ];

      for (const attr of attrs) {
        ctx.font = `10px ${font}`;
        ctx.fillStyle = theme.hudText;
        ctx.fillText(attr.name, innerX, curY);
        ctx.textAlign = 'right';
        ctx.fillText(`${attr.val}`, innerX + innerW, curY);
        ctx.textAlign = 'left';
        curY += 15;
      }

      curY += 6;
      // Divider
      ctx.strokeStyle = theme.borderDark;
      ctx.beginPath();
      ctx.moveTo(innerX, curY);
      ctx.lineTo(innerX + innerW, curY);
      ctx.stroke();
      curY += 12;

      // Capacity & Encumbrance
      let encColor = '#10b981';
      if (stats.encumbranceLevel === EncumbranceLevel.Burdened) encColor = '#f59e0b';
      else if (stats.encumbranceLevel === EncumbranceLevel.Overburdened) encColor = '#f97316';
      else if (stats.encumbranceLevel === EncumbranceLevel.Immobilized) encColor = '#ef4444';

      ctx.font = `bold 10px ${font}`;
      ctx.fillStyle = theme.hudAccent;
      ctx.fillText('LOAD & ENCUMBRANCE:', innerX, curY);
      curY += 16;

      ctx.font = `9px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`Weight: ${stats.carryWeight} / ${stats.maxCarryWeight}g`, innerX, curY);
      curY += 12;

      // Weight bar
      const barH = 5;
      ctx.fillStyle = theme.borderDark;
      ctx.fillRect(innerX, curY, innerW, barH);
      ctx.fillStyle = encColor;
      ctx.fillRect(innerX, curY, Math.floor(innerW * stats.weightRatio), barH);
      curY += 12;

      ctx.font = `9px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`Pack Bulk: ${stats.packBulk} / ${stats.maxPackBulk} cm³`, innerX, curY);
      curY += 14;

      ctx.font = `bold 10px ${font}`;
      ctx.fillStyle = encColor;
      ctx.fillText(`Status: ${stats.encumbranceLevel.toUpperCase()}`, innerX, curY);
      curY += 24;

      ctx.font = `italic 9px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText('Select any item to inspect details', innerX, curY);

    } else {
      // ── Selected State: Item Detailed Breakdown ──
      const breakdown = this.getItemBreakdown(
        this.selectedItem,
        this.selectedSource,
        this.selectedSlot,
        engine.player.inventory.paperdoll
      );

      const titleColor = !breakdown.identified
        ? theme.hudText
        : breakdown.isCursed
        ? '#ef4444'
        : breakdown.isEnchanted
        ? '#c084fc'
        : theme.hudAccent;

      ctx.font = `bold 12px ${font}`;
      ctx.fillStyle = titleColor;
      const displayTitle = breakdown.displayName.length > 22
        ? breakdown.displayName.slice(0, 21) + '…'
        : breakdown.displayName;
      ctx.fillText(displayTitle, innerX, curY);
      curY += 16;

      // Tier & Category
      const tierStr = breakdown.tier ? `Tier ${breakdown.tier} ` : '';
      const catStr = breakdown.category.toUpperCase();
      ctx.font = `10px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`${tierStr}${catStr}`, innerX, curY);
      if (breakdown.isCursed) {
        ctx.fillStyle = '#ef4444';
        ctx.fillText(' [CURSED]', innerX + 80, curY);
      }
      curY += 16;

      // Slot compatibility
      if (breakdown.slotCompatibility.length > 0) {
        ctx.font = `9px ${font}`;
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`Equips To: ${breakdown.slotCompatibility.join(', ')}`, innerX, curY);
        curY += 14;
      }

      // Divider
      ctx.strokeStyle = theme.borderDark;
      ctx.beginPath();
      ctx.moveTo(innerX, curY);
      ctx.lineTo(innerX + innerW, curY);
      ctx.stroke();
      curY += 10;

      // Stats
      if (breakdown.stats.attackBonus !== undefined && breakdown.stats.attackBonus !== 0) {
        ctx.font = `10px ${font}`;
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`Attack Bonus: +${breakdown.stats.attackBonus}`, innerX, curY);
        curY += 14;
      }

      if (breakdown.stats.defenseBonus !== undefined && breakdown.stats.defenseBonus !== 0) {
        ctx.font = `10px ${font}`;
        ctx.fillStyle = '#60a5fa';
        ctx.fillText(`Defense Bonus: +${breakdown.stats.defenseBonus}`, innerX, curY);
        curY += 14;
      }

      if (breakdown.stats.strengthBonus) {
        ctx.font = `10px ${font}`;
        ctx.fillStyle = '#f472b6';
        ctx.fillText(`Strength: +${breakdown.stats.strengthBonus}`, innerX, curY);
        curY += 14;
      }

      if (breakdown.stats.speedBonus) {
        ctx.font = `10px ${font}`;
        ctx.fillStyle = '#34d399';
        ctx.fillText(`Speed: +${breakdown.stats.speedBonus}`, innerX, curY);
        curY += 14;
      }

      if (breakdown.elementalAffix) {
        const affix = breakdown.elementalAffix;
        const icon = affix.element === 'fire' ? '🔥' : affix.element === 'cold' ? '❄️' : '⚡';
        ctx.font = `bold 10px ${font}`;
        ctx.fillStyle = affix.element === 'fire' ? '#f87171' : affix.element === 'cold' ? theme.hudAccent : '#facc15';
        ctx.fillText(`${icon} ${affix.name}: +${affix.bonusDamage} ${affix.element.toUpperCase()}`, innerX, curY);
        curY += 16;
      }

      // Weight, Bulk, Value
      ctx.font = `9px ${font}`;
      ctx.fillStyle = theme.textMuted;
      ctx.fillText(`Weight: ${breakdown.weight}g  |  Volume: ${breakdown.bulk}cm³`, innerX, curY);
      curY += 14;

      if (breakdown.value > 0) {
        ctx.font = `9px ${font}`;
        ctx.fillStyle = '#eab308';
        ctx.fillText(`Value: ${breakdown.value} copper`, innerX, curY);
        curY += 16;
      }

      // Lore Description
      if (breakdown.description) {
        ctx.font = `italic 9px ${font}`;
        ctx.fillStyle = theme.hudText;
        // Simple word wrap
        const words = breakdown.description.split(' ');
        let currentLine = '';
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const width = ctx.measureText(testLine).width;
          if (width > innerW && currentLine) {
            ctx.fillText(currentLine, innerX, curY);
            curY += 12;
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) {
          ctx.fillText(currentLine, innerX, curY);
          curY += 16;
        }
      }

      // Action Buttons at bottom of pane
      const actions = this.getAvailableActions(engine);
      let btnY = y + h - (actions.length * 24 + 10);
      btnY = Math.max(curY + 6, btnY);

      for (const act of actions) {
        const btnH = 20;
        ctx.fillStyle = act.enabled ? theme.modalTitlebar : theme.borderDark;
        ctx.fillRect(innerX, btnY, innerW, btnH);
        ctx.strokeStyle = act.enabled ? theme.hudAccent : theme.cardBorder;
        ctx.lineWidth = 1;
        ctx.strokeRect(innerX + 0.5, btnY + 0.5, innerW - 1, btnH - 1);

        ctx.font = `bold 10px ${font}`;
        ctx.fillStyle = act.enabled ? theme.hudAccent : theme.textMuted;
        ctx.textAlign = 'center';
        ctx.fillText(act.label, innerX + innerW / 2, btnY + 10);
        ctx.textAlign = 'left';

        if (registerClickZone && act.enabled) {
          registerClickZone(innerX, btnY, innerW, btnH, () => act.execute(engine));
        }

        btnY += 24;
      }
    }
  }
}
