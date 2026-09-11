import type { Player } from '../entities/player';
import type { Item } from '../items/item';
import type { TownServicesDefinition } from '../types/manifest';
import {
  COIN_VALUES,
  type ServiceResult,
} from './types';
import {
  formatCurrency,
  getPlayerTotalCp,
  deductCurrencyFromPlayer,
  addCurrencyToPlayer,
  getPlayerCoinItems,
  breakdownChange,
} from './currency';
import type { GameEngine } from '../engine';
import type { WorldState } from '../state/worldState';
import { RunAdvisor, type AdvisoryReport } from '../advisory/runAdvisor';

export class TempleService {
  public static readonly CURSE_CLEANSE_COST_CP = 50 * COIN_VALUES.gold; // 50 GP = 5,000 CP
  public static readonly HEAL_RESTORE_COST_CP = 25 * COIN_VALUES.gold;  // 25 GP = 2,500 CP

  /**
   * Cleanses and unbinds all cursed items equipped on the player's paperdoll.
   */
  public static cleanseCurses(
    player: Player,
    customCostCpOrServices?: number | TownServicesDefinition,
    servicesDef?: TownServicesDefinition,
    engineOrWorldState?: GameEngine | WorldState
  ): ServiceResult {
    let costCp = TempleService.CURSE_CLEANSE_COST_CP;
    let services = servicesDef;

    if (typeof customCostCpOrServices === 'number') {
      costCp = customCostCpOrServices;
    } else if (typeof customCostCpOrServices === 'object') {
      services = customCostCpOrServices;
    }

    const worldState: WorldState | undefined =
      engineOrWorldState && 'worldState' in engineOrWorldState
        ? (engineOrWorldState as GameEngine).worldState
        : (engineOrWorldState as WorldState | undefined);

    if (worldState) {
      const standing = worldState.factions['temple_standing'] ?? 0;
      if (standing < 0) {
        return {
          success: false,
          costInCp: 0,
          message:
            "The High Priest of Thor scowls with righteous fury: 'Desecrator of sacred altars! You have betrayed the gods and are unwelcome here!'",
        };
      }
      if (standing >= 10) {
        costCp = Math.floor(costCp * 0.5);
      }
    }

    const equipped = player.inventory.paperdoll.getAllEquipped();
    const cursedItems = equipped.filter((e) => e.item.quality === 'cursed');

    if (cursedItems.length === 0) {
      return {
        success: false,
        message:
          services?.noCursesMessage ??
          `${services?.priestTitle ?? 'The High Priest of Thor'} senses no foul curses binding your body.`,
        costInCp: 0,
      };
    }

    const playerFundsCp = getPlayerTotalCp(player);
    if (playerFundsCp < costCp) {
      const defaultDonation = `A donation of ${formatCurrency(costCp)} is required to call upon ${services?.priestTitle ?? "Thor's"} cleansing thunder. You have ${formatCurrency(playerFundsCp)}.`;
      const donationMsg = services?.donationRequiredTemplate
        ? services.donationRequiredTemplate
            .replace('{cost}', formatCurrency(costCp))
            .replace('{funds}', formatCurrency(playerFundsCp))
        : defaultDonation;
      return {
        success: false,
        message: donationMsg,
        costInCp: costCp,
      };
    }

    // Deduct donation fee
    const deduction = deductCurrencyFromPlayer(player, costCp);
    if (!deduction.success) {
      return deduction;
    }

    // Unbind and normalize cursed items
    const cleansedNames: string[] = [];
    for (const entry of cursedItems) {
      // Cast away cursed flag
      (entry.item as { quality: string }).quality = 'normal';
      (entry.item as { identified: boolean }).identified = true;
      cleansedNames.push(entry.item.name);
      // Safely unequip to pack if space allows
      player.inventory.paperdoll.unequip(entry.slot);
      player.inventory.primaryPack.addItem(entry.item);
    }

    const defaultSuccess = `Thor's divine lightning shatters the foul bindings on: ${cleansedNames.join(', ')}! The items are now safely stored in your pack.`;
    const message = services?.cleanseMessageTemplate
      ? services.cleanseMessageTemplate
          .replace('{items}', cleansedNames.join(', '))
          .replace('{item}', cleansedNames.join(', '))
      : defaultSuccess;

    return {
      success: true,
      message,
      costInCp: costCp,
    };
  }

  /**
   * Cures all active status afflictions and fully restores Hit Points and Mana.
   */
  public static healAndRestore(
    player: Player,
    customCostCpOrServices?: number | TownServicesDefinition,
    servicesDef?: TownServicesDefinition,
    engineOrWorldState?: GameEngine | WorldState
  ): ServiceResult {
    let costCp = TempleService.HEAL_RESTORE_COST_CP;
    let services = servicesDef;

    if (typeof customCostCpOrServices === 'number') {
      costCp = customCostCpOrServices;
    } else if (typeof customCostCpOrServices === 'object') {
      services = customCostCpOrServices;
    }

    const worldState: WorldState | undefined =
      engineOrWorldState && 'worldState' in engineOrWorldState
        ? (engineOrWorldState as GameEngine).worldState
        : (engineOrWorldState as WorldState | undefined);

    if (worldState) {
      const standing = worldState.factions['temple_standing'] ?? 0;
      if (standing < 0) {
        return {
          success: false,
          costInCp: 0,
          message:
            "The High Priest of Thor scowls with righteous fury: 'Desecrator of sacred altars! You have betrayed the gods and are unwelcome here!'",
        };
      }
      if (standing >= 10) {
        costCp = Math.floor(costCp * 0.5);
      }
    }

    const isFullHp = player.hp >= player.maxHp;
    const isFullMana = player.mana >= player.maxMana;
    const hasStatus = player.statusManager.getAll().length > 0;

    if (isFullHp && isFullMana && !hasStatus) {
      return {
        success: false,
        message: 'Your body and mind are already in peak vitality. No healing is needed.',
        costInCp: 0,
      };
    }

    const playerFundsCp = getPlayerTotalCp(player);
    if (playerFundsCp < costCp) {
      return {
        success: false,
        message: `A donation of ${formatCurrency(costCp)} is required for sacred restoration. You have ${formatCurrency(playerFundsCp)}.`,
        costInCp: costCp,
      };
    }

    // Deduct donation fee
    const deduction = deductCurrencyFromPlayer(player, costCp);
    if (!deduction.success) {
      return deduction;
    }

    // Clear all status effects
    player.statusManager.clear();
    player.hp = player.maxHp;
    player.mana = player.maxMana;

    const defaultHealMsg =
      'The Priest of Thor bathes you in golden light! All afflictions are cured, and your HP and Mana are fully restored!';
    const message = services?.healMessageTemplate ?? defaultHealMsg;

    return {
      success: true,
      message,
      costInCp: costCp,
    };
  }
}

export class SageService {
  public static readonly IDENTIFY_FEE_CP = 20 * COIN_VALUES.gold; // 20 GP = 2,000 CP

  /**
   * Identifies an unknown item, revealing its real name and stats.
   */
  public static identifyItem(
    player: Player,
    itemOrId: Item | string,
    customFeeCp?: number,
    services?: TownServicesDefinition
  ): ServiceResult {
    const feeCp = customFeeCp ?? SageService.IDENTIFY_FEE_CP;
    const sageName = services?.sageName ?? services?.sageTitle ?? 'Sage Mimir';

    let item: Item | null = null;
    if (typeof itemOrId === 'string') {
      item =
        player.inventory.primaryPack.getItem(itemOrId) ??
        player.inventory.belt?.getItem(itemOrId) ??
        player.inventory.paperdoll.getAllEquipped().find((e) => e.item.id === itemOrId)?.item ??
        null;
      if (!item) {
        return { success: false, message: 'Could not find that item in your inventory.', costInCp: 0 };
      }
    } else {
      item = itemOrId;
    }

    if (item.identified) {
      return {
        success: false,
        message: `${item.displayName} is already identified.`,
        costInCp: 0,
      };
    }

    const playerFundsCp = getPlayerTotalCp(player);
    if (playerFundsCp < feeCp) {
      return {
        success: false,
        message: `${sageName} requires ${formatCurrency(feeCp)} to consult the ancient tomes. You have ${formatCurrency(playerFundsCp)}.`,
        costInCp: feeCp,
      };
    }

    const deduction = deductCurrencyFromPlayer(player, feeCp);
    if (!deduction.success) {
      return deduction;
    }

    (item as { identified: boolean }).identified = true;

    return {
      success: true,
      message: `${sageName} traces the hidden runes: This is ${item.displayName}! (${item.description})`,
      costInCp: feeCp,
    };
  }

  /**
   * Evaluates the hero's readiness and returns strategic run advisory.
   */
  public static getRunAdvisory(engine: GameEngine, customFloor?: number): AdvisoryReport {
    return RunAdvisor.evaluateRun(engine, customFloor);
  }
}

export class BankService {
  /**
   * Exchanges and compacts all loose coins in player's possession into
   * highest denomination coinage (Platinum and Gold), drastically reducing encumbrance weight.
   */
  public static compactCurrency(
    player: Player,
    services?: TownServicesDefinition
  ): ServiceResult {
    const totalCp = getPlayerTotalCp(player);
    if (totalCp <= 0) {
      return {
        success: false,
        message: 'You have no coins to exchange.',
        costInCp: 0,
      };
    }

    // Measure weight before compaction
    const coinsBefore = getPlayerCoinItems(player);
    const weightBefore = coinsBefore.reduce((sum, c) => sum + c.item.totalWeight(), 0);

    // Calculate canonical highest-denomination breakdown
    const compacted = breakdownChange(totalCp);
    const weightAfter =
      (compacted.platinum + compacted.gold + compacted.silver + compacted.copper) * 10;

    if (weightAfter >= weightBefore) {
      return {
        success: false,
        message: `Your coinage is already compacted into optimal denominations (${formatCurrency(totalCp)}).`,
        costInCp: 0,
      };
    }

    // Remove all existing coins
    for (const { container, item } of coinsBefore) {
      container.removeItem(item.id);
    }

    // Deposit compacted coins
    addCurrencyToPlayer(player, compacted);

    const savedGrams = weightBefore - weightAfter;
    const bankerTitle = services?.bankerTitle ?? 'Banker Haakon';
    const defaultMsg = `${bankerTitle} exchanged your currency into ${formatCurrency(totalCp)}! Carry weight reduced by ${savedGrams}g (from ${weightBefore}g to ${weightAfter}g).`;
    const message = services?.compactionMessageTemplate
      ? services.compactionMessageTemplate
          .replace('{coins}', formatCurrency(totalCp))
          .replace('{savedWeight}', savedGrams.toString())
          .replace('{oldWeight}', weightBefore.toString())
          .replace('{newWeight}', weightAfter.toString())
      : defaultMsg;

    return {
      success: true,
      message,
      costInCp: 0,
      weightSavedGrams: savedGrams,
    };
  }
}
