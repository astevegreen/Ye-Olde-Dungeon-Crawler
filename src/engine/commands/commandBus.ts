import type { GameEngine } from '../engine';
import { getItemById, itemIndex } from '../items/itemIndex';
import type { Item, EquipmentSlot } from '../items/item';
import type { VisualEffectDescriptor } from '../types';
import { Container } from '../items/container';
import { PotionItem, ScrollItem, WandItem } from '../items/consumables';
import { splitItemStack } from '../items/stacking';
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
import { TempleService, SageService, BankService, TrainerService } from '../economy/services';
import { LoreService } from '../economy/lore';
import { SmithService } from '../economy/smith';
import { type Merchant, getItemSellPrice, isSellable } from '../economy/merchant';
import { formatCurrency } from '../economy/currency';
import type { CompanionArchetype } from '../entities/companion';
import { ChannelRuneOfReturnAction, RuneOfReturnItem, cancelChannel } from '../magic/runeOfReturn';
import { recordMilestone } from '../renown/renownLedger';
import { flightRecorder } from '../debug/flightRecorder';
import type { Action } from '../actions/action';
import type { ActionResult } from '../types';

/** Commands that change nothing a replay depends on: no checkpoint after them. */
const READ_ONLY_COMMANDS = new Set(['open_container', 'sage_advisory']);

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

  /** Whether the command now running went through `handlePlayerAction` (`act`). */
  private acted = false;

  /**
   * Runs a command. One that changed state without going through `handlePlayerAction`
   * (a sort, a split, a junk mark, a pact, a trade, a town service, a companion skill) is
   * not in the replay trail, so it asks for a checkpoint: the replay then starts from the
   * state it left (ARCHITECTURE.md §2).
   */
  public dispatch(command: GameCommand): GameCommandResult {
    const outer = this.acted;
    this.acted = false;
    try {
      const result = this.run(command);
      if (result.success && !this.acted && !READ_ONLY_COMMANDS.has(command.type)) {
        flightRecorder.requestCheckpoint(`command: ${command.type}`);
      }
      return result;
    } finally {
      this.acted = outer;
    }
  }

  /**
   * A command's player action, through the pipeline and so into the trail. A modal pause
   * stops the world idling, not the turn an action costs: one taken from inside an open menu
   * (a potion drunk, armour swapped) lets the monsters answer it, as it would with the menu
   * closed and as the replay, never paused, does.
   */
  private act(action: Action): ActionResult {
    this.acted = true;
    const paused = this.engine.isPaused;
    if (paused) this.engine.setPaused(false);
    try {
      return this.engine.handlePlayerAction(action);
    } finally {
      if (paused) this.engine.setPaused(true);
    }
  }

  private run(command: GameCommand): GameCommandResult {
    const p = command.payload ?? {};

    switch (command.type) {
      // ─────────────────────────────────────────────────────────────
      // Inventory & Consumable Actions
      // ─────────────────────────────────────────────────────────────
      case 'drink_potion': {
        const item = this.resolveItem(p.itemId as string);
        if (item instanceof PotionItem) {
          const res = this.act(new DrinkPotionAction(this.engine.player, item));
          return { success: res.success, message: res.message };
        }
        return { success: false, message: 'Not a potion' };
      }

      case 'read_scroll': {
        const item = this.resolveItem(p.itemId as string);
        if (item instanceof ScrollItem) {
          const targetX = p.targetX as number | undefined;
          const targetY = p.targetY as number | undefined;
          const res = this.act(
            new ReadScrollAction(this.engine.player, item, targetX, targetY, p.itemTargetId as string | undefined)
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
          const res = this.act(
            new ZapWandAction(this.engine.player, item, targetX, targetY)
          );
          return { success: res.success, message: res.message, effects: res.effects };
        }
        return { success: false, message: 'Not a wand' };
      }

      case 'channel_rune_of_return': {
        const item = this.resolveItem(p.itemId as string);
        if (!(item instanceof RuneOfReturnItem)) {
          return { success: false, message: 'Not a Rune of Return' };
        }
        const res = this.act(new ChannelRuneOfReturnAction(this.engine.player));
        return { success: res.success, message: res.message };
      }

      case 'cancel_rune_of_return_channel': {
        const res = cancelChannel(this.engine, this.engine.player);
        return { success: res.success, message: res.message };
      }

      case 'equip_item': {
        const itemId = p.itemId as string;
        if (!itemId) return { success: false, message: 'No item specified to equip' };
        const res = this.act(new EquipAction(this.engine.player, itemId));
        return { success: res.success, message: res.message };
      }

      case 'unequip_item': {
        const slot = p.slot as EquipmentSlot;
        if (!slot) return { success: false, message: 'No slot specified to unequip' };
        const res = this.act(new UnequipAction(this.engine.player, slot));
        return { success: res.success, message: res.message };
      }

      case 'drop_item': {
        const item = p.item as Item ?? this.resolveItem(p.itemId as string);
        if (!item) return { success: false, message: 'Item not found to drop' };
        const source = (p.source as 'paperdoll' | 'pack') ?? 'pack';
        const slot = p.slot as EquipmentSlot | undefined;
        const res = this.act(new DropAction(this.engine.player, item, source, slot));
        return { success: res.success, message: res.message };
      }

      case 'pickup_item': {
        const itemId = p.itemId as string;
        const free = Boolean(p.freeAction);
        if (!itemId) return { success: false, message: 'No item specified to pick up' };
        const res = this.act(new PickUpAction(this.engine.player, itemId, free));
        return { success: res.success, message: res.message };
      }

      // Instant bookkeeping with no turn cost, preserving the behavior of the former direct sort calls.
      case 'sort_pack': {
        const mode = p.mode as Parameters<Container['sort']>[0];
        if (!mode) return { success: false, message: 'No sort mode specified' };
        this.engine.player.inventory.primaryPack.sort(mode);
        const message = `Sorted backpack items by ${mode.toUpperCase()}.`;
        this.engine.log(message);
        return { success: true, message };
      }

      // Looking inside a container is free bookkeeping, like sort_pack: it only records
      // that the player has seen its contents (Container.wasOpened, flagged on the HUD).
      case 'open_container': {
        const container = p.container as Container | undefined;
        if (!(container instanceof Container)) return { success: false, message: 'Invalid container' };
        container.markOpened();
        return { success: true };
      }

      case 'quick_loot': {
        const res = this.act(new QuickLootAction(this.engine.player));
        return { success: res.success, message: res.message };
      }

      case 'loot_container': {
        const container = p.container as Container;
        const item = p.item as Item ?? container?.getItems().find((i) => i.id === p.itemId);
        if (!container || !item) return { success: false, message: 'Invalid container loot command' };
        const res = this.act(
          new LootFromContainerAction(this.engine.player, container, item)
        );
        return { success: res.success, message: res.message };
      }

      case 'loot_all_container': {
        const container = p.container as Container;
        if (!container) return { success: false, message: 'Invalid container' };
        const res = this.act(
          new LootAllFromContainerAction(this.engine.player, container)
        );
        return { success: res.success, message: res.message };
      }

      case 'store_container': {
        const container = p.container as Container;
        const item = p.item as Item ?? this.resolveItem(p.itemId as string);
        if (!container || !item) return { success: false, message: 'Invalid container store command' };
        const res = this.act(
          new StoreInContainerAction(this.engine.player, container, item)
        );
        return { success: res.success, message: res.message };
      }

      case 'split_stack': {
        const item = (p.item as Item) ?? this.resolveItem(p.itemId as string);
        const amount = p.amount as number;
        if (!item || !Number.isInteger(amount) || amount <= 0 || amount >= (item.quantity ?? 1)) {
          return { success: false, message: 'Invalid split amount' };
        }
        // A fresh id from the index, not the simulation PRNG: the split spends no draw.
        let n = 1;
        while (getItemById(`${item.id}-split-${n}`)) n++;
        const splitItem = splitItemStack(item, amount, `${item.id}-split-${n}`);
        const destContainer = (p.container as Container) ?? this.engine.player.inventory.primaryPack;
        // No room for a new pile (a belt's slots, say): the stack is left whole.
        const room = destContainer.canContain(splitItem, false);
        if (!room.allowed) {
          item.quantity += amount;
          return { success: false, message: room.reason ?? 'There is no room for the split stack.' };
        }
        destContainer.addItem(splitItem, false);
        const message = `Split ${amount} ${splitItem.displayName}.`;
        this.engine.log(message);
        return { success: true, message, data: { splitItem } };
      }

      // Companions & Pet Progression, Phase 2 (docs/architecture/content-companions.md): the
      // companion's pack is a plain Container, so these reuse the existing
      // container-transfer actions rather than needing new ones.
      case 'transfer_to_companion': {
        if (!this.engine.companion) return { success: false, message: 'You have no companion to give items to.' };
        const item = (p.item as Item) ?? this.resolveItem(p.itemId as string);
        if (!item) return { success: false, message: 'Item not found.' };
        const res = this.act(
          new StoreInContainerAction(this.engine.player, this.engine.companion.inventory.primaryPack, item)
        );
        return { success: res.success, message: res.message };
      }

      case 'transfer_from_companion': {
        if (!this.engine.companion) return { success: false, message: 'You have no companion to take items from.' };
        const item = (p.item as Item) ?? this.resolveItem(p.itemId as string);
        if (!item) return { success: false, message: 'Item not found.' };
        const res = this.act(
          new LootFromContainerAction(this.engine.player, this.engine.companion.inventory.primaryPack, item)
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
        const res = this.act(
          new CastSpellAction(this.engine.player, spellId, targetX, targetY, p.itemTargetId as string | undefined)
        );
        return { success: res.success, message: res.message, effects: res.effects };
      }

      // ─────────────────────────────────────────────────────────────
      // Economy & Town Services
      // ─────────────────────────────────────────────────────────────
      case 'buy_item': {
        const merchant = (p.merchant as Merchant) ?? this.engine.merchants.get(p.merchantId as string);
        const itemIndex = p.itemIndex as number | string;
        if (!merchant || itemIndex === undefined) {
          return { success: false, message: 'Invalid buy request' };
        }
        const res = merchant.buyItem(this.engine.player, itemIndex, this.engine.worldState, this.engine.manifest.merchantPricing);
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

      // A mark the hero keeps on a carried item: bookkeeping outside the turn order, like a trade.
      case 'mark_junk': {
        const item = this.engine.player.inventory.findItemById(p.itemId as string);
        if (!item || item.category === 'currency') return { success: false, message: 'Nothing to mark as junk.' };
        const junk = p.junk === undefined ? !item.junk : Boolean(p.junk);
        // A junk container would be sold with everything in it (R-econ-19).
        if (junk && item instanceof Container && item.itemCount > 0) {
          const refusal = `Empty the ${item.displayName} before marking it as junk.`;
          this.engine.log(refusal);
          return { success: false, message: refusal };
        }
        item.junk = junk;
        const message = item.junk ? `${item.displayName} is marked as junk.` : `${item.displayName} is no longer junk.`;
        this.engine.log(message);
        return { success: true, message };
      }

      // Sells everything in the pack marked as junk, one sale at a time.
      case 'sell_junk': {
        const merchant = (p.merchant as Merchant) ?? this.engine.merchants.get(p.merchantId as string);
        if (!merchant) return { success: false, message: 'Invalid sell request' };
        const marked = this.engine.player.inventory.primaryPack.getItems().filter((i) => i.junk && isSellable(i));
        // A container filled since it was marked stays, with what it holds (R-econ-19).
        const kept = marked.filter((i) => i instanceof Container && i.itemCount > 0);
        const junk = marked.filter((i) => !kept.includes(i));
        const keptNote = kept.map((i) => ` The ${i.displayName} is not empty: it stays.`).join('');
        if (junk.length === 0) {
          const message = kept.length ? keptNote.trim() : 'Nothing in your pack is marked as junk.';
          if (kept.length) this.engine.log(message);
          return { success: false, message };
        }
        let sold = 0;
        let paid = 0;
        for (const item of junk) {
          const price = getItemSellPrice(item);
          if (merchant.sellItem(this.engine.player, item).success) {
            sold += 1;
            paid += price;
          }
        }
        const message = `Sold ${sold} junk item${sold === 1 ? '' : 's'} for ${formatCurrency(paid)}.${keptNote}`;
        this.engine.log(message);
        return { success: sold > 0, message };
      }

      case 'temple_cleanse': {
        const res = TempleService.cleanseCurses(this.engine.player, undefined, undefined, this.engine);
        this.engine.log(res.message);
        // The temple is where curses are really broken (UncurseAction is a scroll's path).
        if (res.success) recordMilestone(this.engine, 'item_uncursed');
        return { success: res.success, message: res.message };
      }

      // Offerings and blessings (tracker 2.6): outside the turn order, like every town service.
      case 'temple_offer': {
        const item = (p.item as Item) ?? this.engine.player.inventory.findItemById(p.itemId as string);
        if (!item) return { success: false, message: 'Nothing chosen to offer.' };
        const res = TempleService.makeOffering(this.engine, item);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'temple_bless': {
        const item = (p.item as Item | undefined) ?? (p.itemId ? this.engine.player.inventory.findItemById(p.itemId as string) ?? undefined : undefined);
        const res = TempleService.receiveBlessing(this.engine, p.blessingId as string, item);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      // The smith's forge (tracker 2.7): a step up, or the one-time masterwork.
      case 'smith_upgrade':
      case 'smith_masterwork': {
        const item = (p.item as Item) ?? this.engine.player.inventory.findItemById(p.itemId as string);
        const npcId = p.npcId as string;
        if (!item || !npcId) return { success: false, message: 'Nothing chosen for the forge.' };
        const res = command.type === 'smith_upgrade' ? SmithService.upgrade(this.engine, npcId, item) : SmithService.masterwork(this.engine, npcId, item);
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
        const res = SageService.identifyItem(this.engine.player, targetItem, undefined, this.engine.manifest.town?.services);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      // The sage's monster lore (tracker 4.1): one bestiary rank, or an unmet creature revealed.
      case 'sage_study':
      case 'sage_rumor': {
        const id = p.definitionId as string;
        if (!id) return { success: false, message: 'No creature chosen.' };
        const res = command.type === 'sage_study' ? LoreService.study(this.engine, id) : LoreService.rumor(this.engine, id);
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

      case 'pact_toggle': {
        const pactId = p.pactId as string;
        const pact = this.engine.pacts.getPact(pactId);
        if (!pact) return { success: false, message: 'There is no such pact.' };
        this.engine.pacts.togglePact(pactId);
        const sealed = this.engine.pacts.isPactActive(pactId);
        return { success: true, message: sealed ? `Sealed: ${pact.name}.` : `Renounced: ${pact.name}.` };
      }

      case 'bank_compact': {
        const res = BankService.compactCurrency(this.engine.player, this.engine.manifest.town?.services);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'trainer_bond_companion': {
        const res = TrainerService.bondCompanion(this.engine);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'trainer_revive_companion': {
        const res = TrainerService.reviveCompanion(this.engine);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'trainer_switch_archetype': {
        const archetype = p.archetype as CompanionArchetype;
        const res = TrainerService.switchArchetype(this.engine, archetype);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      case 'trainer_teach_skill': {
        const skillId = p.skillId as string;
        const skillName = p.skillName as string | undefined;
        const res = TrainerService.teachSkill(this.engine, skillId, skillName);
        this.engine.log(res.message);
        return { success: res.success, message: res.message };
      }

      // Companions & Pet Progression, Phase 2 (docs/architecture/content-companions.md): one example
      // active companion skill, unlocked via 'trainer_teach_skill'. Instant utility
      // (no player turn cost), matching 'sage_advisory''s existing pattern above.
      case 'use_companion_skill': {
        const skillId = p.skillId as string;
        const companion = this.engine.companion;
        if (!companion) {
          return { success: false, message: 'You have no companion here to command.' };
        }
        if (!companion.unlockedSkills.includes(skillId)) {
          return { success: false, message: `${companion.name} has not learned that skill.` };
        }
        if (skillId === 'rally_howl') {
          const healed = companion.heal(Math.ceil(companion.maxHp * 0.2));
          this.engine.player.statusManager.applyStatus(
            { type: 'haste', duration: 3 },
            this.engine.player.statusImmunities,
            this.engine.player,
            this.engine
          );
          const msg = `${companion.name} lets out a rallying howl! (+${healed} HP to ${companion.name}, you feel hastened for 3 turns)`;
          this.engine.log(msg);
          return { success: true, message: msg };
        }
        return { success: false, message: `Unknown companion skill: '${skillId}'` };
      }

      // Loose coins from the pack into the purse; `data` says how many stacks and how much.
      case 'consolidate_coins': {
        const res = this.engine.player.inventory.consolidateCoins();
        return { success: res.count > 0, data: res };
      }

      // The hero's companion called to their side, or sent away (Shift+C).
      case 'summon_companion': {
        const id = p.companionId as string | undefined;
        return { success: !!id && this.engine.summonCompanion(id) !== null };
      }
      case 'dismiss_companion': {
        if (!this.engine.companion) return { success: false };
        this.engine.dismissCompanion();
        return { success: true };
      }

      default:
        return {
          success: false,
          message: `Unknown command type: '${command.type}'`,
        };
    }
  }

  /**
   * Resolves an item id through the flat index (ARCHITECTURE.md §5) rather than walking
   * packs and floor tiles. Reachability is unchanged: a command may only act on an item the
   * player carries, wears, or is standing on.
   */
  private resolveItem(itemId?: string): Item | undefined {
    if (!itemId) return undefined;
    const item = getItemById(itemId);
    if (!item) return undefined;

    const player = this.engine.player;
    const location = itemIndex.locationOf(itemId);
    if (!location) return undefined;
    if (location.kind === 'ground') {
      return location.x === player.x && location.y === player.y ? item : undefined;
    }
    if (player.inventory.findItemById(itemId)) return item;
    // The active companion's pack is reachable too — that is what taking an item back
    // from it means (ARCHITECTURE.md §3).
    return this.engine.companion?.inventory.findItemById(itemId) ? item : undefined;
  }
}
