import type { GameEngine } from '../engine';
import type { Item, EquipmentSlot } from '../items/item';
import type { VisualEffectDescriptor } from '../types';
import { Container } from '../items/container';
import { PotionItem, ScrollItem, WandItem } from '../items/consumables';
import {
  EquipAction,
  UnequipAction,
  DropAction,
  PickUpAction,
  LootFromContainerAction,
  StoreInContainerAction,
  LootAllFromContainerAction,
  QuickLootAction,
} from '../actions/inventory-actions';
import {
  CastSpellAction,
  ZapWandAction,
  ReadScrollAction,
  DrinkPotionAction,
} from '../actions/spell-actions';
import { TempleService, SageService, BankService } from '../economy/services';
import type { Merchant } from '../economy/merchant';

/**
 * GameCommand — encapsulates a player/UI intent into a decoupled command message.
 */
export interface GameCommand {
  readonly type: string;
  readonly payload?: Record<string, unknown>;
}

/**
 * Result returned by the command bus after processing a command.
 */
export interface GameCommandResult {
  readonly success: boolean;
  readonly message?: string;
  readonly data?: unknown;
  readonly effects?: VisualEffectDescriptor[];
}

/**
 * Interface for the command bus dispatch layer.
 */
export interface GameCommandBus {
  dispatch(command: GameCommand): GameCommandResult;
}

/**
 * EngineCommandBus — executes GameCommands by translating them into engine actions
 * and subsystem service calls. Decouples UI and rendering from concrete action classes.
 */
export class EngineCommandBus implements GameCommandBus {
  private engine: GameEngine;

  constructor(engine: GameEngine) {
    this.engine = engine;
  }

  public dispatch(command: GameCommand): GameCommandResult {
    const p = command.payload ?? {};

    switch (command.type) {
      // ─────────────────────────────────────────────────────────────
      // Inventory & Consumable Actions
      // ─────────────────────────────────────────────────────────────
      case 'drink_potion': {
        const item = this.resolveItem(p.itemId as string);
        if (item instanceof PotionItem) {
          const res = this.engine.handlePlayerAction(new DrinkPotionAction(this.engine.player, item));
          return { success: res.success, message: res.message };
        }
        return { success: false, message: 'Not a potion' };
      }

      case 'read_scroll': {
        const item = this.resolveItem(p.itemId as string);
        if (item instanceof ScrollItem) {
          const targetX = p.targetX as number | undefined;
          const targetY = p.targetY as number | undefined;
          const res = this.engine.handlePlayerAction(
            new ReadScrollAction(this.engine.player, item, targetX, targetY)
          );
          return { success: res.success, message: res.message, effects: res.effects };
        }
        return { success: false, message: 'Not a scroll' };
      }

      case 'zap_wand': {
        const item = this.resolveItem(p.itemId as string);
        if (item instanceof WandItem) {
          const targetX = (p.targetX as number | undefined) ?? this.engine.player.x;
          const targetY = (p.targetY as number | undefined) ?? this.engine.player.y;
          const res = this.engine.handlePlayerAction(
            new ZapWandAction(this.engine.player, item, targetX, targetY)
          );
          return { success: res.success, message: res.message, effects: res.effects };
        }
        return { success: false, message: 'Not a wand' };
      }

      case 'equip_item': {
        const itemId = p.itemId as string;
        if (!itemId) return { success: false, message: 'No item specified to equip' };
        const res = this.engine.handlePlayerAction(new EquipAction(this.engine.player, itemId));
        return { success: res.success, message: res.message };
      }

      case 'unequip_item': {
        const slot = p.slot as EquipmentSlot;
        if (!slot) return { success: false, message: 'No slot specified to unequip' };
        const res = this.engine.handlePlayerAction(new UnequipAction(this.engine.player, slot));
        return { success: res.success, message: res.message };
      }

      case 'drop_item': {
        const item = p.item as Item ?? this.resolveItem(p.itemId as string);
        if (!item) return { success: false, message: 'Item not found to drop' };
        const source = (p.source as 'paperdoll' | 'pack') ?? 'pack';
        const slot = p.slot as EquipmentSlot | undefined;
        const res = this.engine.handlePlayerAction(new DropAction(this.engine.player, item, source, slot));
        return { success: res.success, message: res.message };
      }

      case 'pickup_item': {
        const itemId = p.itemId as string;
        if (!itemId) return { success: false, message: 'No item specified to pick up' };
        const res = this.engine.handlePlayerAction(new PickUpAction(this.engine.player, itemId));
        return { success: res.success, message: res.message };
      }

      case 'quick_loot': {
        const res = this.engine.handlePlayerAction(new QuickLootAction(this.engine.player));
        return { success: res.success, message: res.message };
      }

      case 'loot_container': {
        const container = p.container as Container;
        const item = p.item as Item ?? container?.getItems().find((i) => i.id === p.itemId);
        if (!container || !item) return { success: false, message: 'Invalid container loot command' };
        const res = this.engine.handlePlayerAction(
          new LootFromContainerAction(this.engine.player, container, item)
        );
        return { success: res.success, message: res.message };
      }

      case 'loot_all_container': {
        const container = p.container as Container;
        if (!container) return { success: false, message: 'Invalid container' };
        const res = this.engine.handlePlayerAction(
          new LootAllFromContainerAction(this.engine.player, container)
        );
        return { success: res.success, message: res.message };
      }

      case 'store_container': {
        const container = p.container as Container;
        const item = p.item as Item ?? this.resolveItem(p.itemId as string);
        if (!container || !item) return { success: false, message: 'Invalid container store command' };
        const res = this.engine.handlePlayerAction(
          new StoreInContainerAction(this.engine.player, container, item)
        );
        return { success: res.success, message: res.message };
      }

      // ─────────────────────────────────────────────────────────────
      // Spells & Combat Actions
      // ─────────────────────────────────────────────────────────────
      case 'cast_spell': {
        const spellId = p.spellId as string;
        const targetX = p.targetX as number;
        const targetY = p.targetY as number;
        if (!spellId || targetX === undefined || targetY === undefined) {
          return { success: false, message: 'Incomplete spell target parameters' };
        }
        const res = this.engine.handlePlayerAction(
          new CastSpellAction(this.engine.player, spellId, targetX, targetY)
        );
        return { success: res.success, message: res.message, effects: res.effects };
      }

      // ─────────────────────────────────────────────────────────────
      // Economy & Town Services
      // ─────────────────────────────────────────────────────────────
      case 'buy_item': {
        const merchant = (p.merchant as Merchant) ?? this.engine.merchants.get(p.merchantId as string);
        const itemIndex = p.itemIndex as number;
        if (!merchant || itemIndex === undefined) {
          return { success: false, message: 'Invalid buy request' };
        }
        const res = merchant.buyItem(this.engine.player, itemIndex);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'sell_item': {
        const merchant = (p.merchant as Merchant) ?? this.engine.merchants.get(p.merchantId as string);
        const item = (p.item as Item) ?? this.resolveItem(p.itemId as string);
        if (!merchant || !item) {
          return { success: false, message: 'Invalid sell request' };
        }
        const res = merchant.sellItem(this.engine.player, item);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'temple_cleanse': {
        const res = TempleService.cleanseCurses(this.engine.player, undefined, undefined, this.engine);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'temple_heal': {
        const res = TempleService.healAndRestore(this.engine.player, undefined, undefined, this.engine);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'sage_identify': {
        let targetItem = p.item as Item | undefined;
        if (!targetItem) {
          const unIdPack = this.engine.player.inventory.primaryPack.getItems().find((i) => !i.identified);
          const unIdDoll = this.engine.player.inventory.paperdoll.getAllEquipped().find((e) => !e.item.identified);
          targetItem = unIdPack ?? unIdDoll?.item;
        }
        if (!targetItem) {
          const sageName = this.engine.manifest?.town?.services?.sageName ?? 'The Sage';
          return {
            success: false,
            message: `${sageName} senses no unidentified items in your possession.`,
          };
        }
        const res = SageService.identifyItem(this.engine.player, targetItem);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'sage_advisory': {
        const rep = SageService.getRunAdvisory(this.engine);
        const sageName = this.engine.manifest?.town?.services?.sageName ?? 'The Sage';
        let summaryMsg: string;
        if (rep.warnings.length === 0) {
          summaryMsg = `${sageName}: "${rep.summary}" ${rep.sageQuote}`;
        } else {
          const firstWarn = rep.warnings[0];
          summaryMsg = `${sageName} warns (${firstWarn.title}): ${firstWarn.recommendation}`;
        }
        this.engine.log(`*** SAGE RUN ADVISORY: ${rep.summary} ***`);
        for (const w of rep.warnings) {
          this.engine.log(`[Advisory ${w.severity.toUpperCase()}] ${w.title}: ${w.message} -> ${w.recommendation}`);
        }
        return {
          success: true,
          message: summaryMsg,
          data: rep,
        };
      }

      case 'bank_compact': {
        const res = BankService.compactCurrency(this.engine.player);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      default:
        return {
          success: false,
          message: `Unknown command type: '${command.type}'`,
        };
    }
  }

  private resolveItem(itemId?: string): Item | undefined {
    if (!itemId) return undefined;
    const player = this.engine.player;
    return (
      player.inventory.findItemById(itemId) ??
      this.engine.map.getItemsAt(player.x, player.y).find((i) => i.id === itemId)
    );
  }
}
