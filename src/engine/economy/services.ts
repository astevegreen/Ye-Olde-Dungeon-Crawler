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
import type { CompanionArchetype } from '../entities/companion';

export class TempleService {
  public static readonly CURSE_CLEANSE_COST_CP = 50 * COIN_VALUES.gold; // 50 GP = 5,000 CP
  public static readonly HEAL_RESTORE_COST_CP = 25 * COIN_VALUES.gold;  // 25 GP = 2,500 CP

  /** Town services from the engine manifest, when the caller passed an engine. */
  private static manifestServices(engineOrWorldState?: GameEngine | WorldState): TownServicesDefinition | undefined {
    return engineOrWorldState && 'manifest' in engineOrWorldState
      ? engineOrWorldState.manifest.town?.services
      : undefined;
  }

  /**
   * Standing and corruption gate shared by every temple service: negative standing
   * (or corruption past the pack's refusal threshold) refuses service; corruption past
   * the surcharge threshold multiplies the price; favored standing (>= 10) halves it.
   */
  private static applyTempleStanding(
    player: Player,
    costCp: number,
    services: TownServicesDefinition | undefined,
    engineOrWorldState?: GameEngine | WorldState
  ): { refusal?: ServiceResult; costCp: number } {
    const worldState: WorldState | undefined =
      engineOrWorldState && 'worldState' in engineOrWorldState
        ? (engineOrWorldState as GameEngine).worldState
        : (engineOrWorldState as WorldState | undefined);
    if (!worldState) {
      return { costCp };
    }

    const standing = worldState.factions[services?.templeStandingFaction ?? 'temple_standing'] ?? 0;
    const refusalThreshold = services?.corruptionRefusalThreshold;
    if (standing < 0 || (refusalThreshold !== undefined && player.corruptionScore >= refusalThreshold)) {
      return {
        costCp,
        refusal: {
          success: false,
          costInCp: 0,
          message: services?.templeRefusalMessage ?? `${services?.priestTitle ?? 'The priest'} refuses to serve you.`,
        },
      };
    }

    const surchargeThreshold = services?.corruptionSurchargeThreshold;
    if (surchargeThreshold !== undefined && player.corruptionScore >= surchargeThreshold) {
      return { costCp: Math.floor(costCp * (services?.corruptionSurchargeMultiplier ?? 2)) };
    }
    if (standing >= 10) {
      return { costCp: Math.floor(costCp * 0.5) };
    }
    return { costCp };
  }

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

    services ??= TempleService.manifestServices(engineOrWorldState);
    const gate = TempleService.applyTempleStanding(player, costCp, services, engineOrWorldState);
    if (gate.refusal) {
      return gate.refusal;
    }
    costCp = gate.costCp;

    const equipped = player.inventory.paperdoll.getAllEquipped();
    const cursedItems = equipped.filter((e) => e.item.quality === 'cursed');

    if (cursedItems.length === 0) {
      return {
        success: false,
        message:
          services?.noCursesMessage ??
          `${services?.priestTitle ?? 'The priest'} senses no foul curses binding your body.`,
        costInCp: 0,
      };
    }

    const playerFundsCp = getPlayerTotalCp(player);
    if (playerFundsCp < costCp) {
      const defaultDonation = `A donation of ${formatCurrency(costCp)} is required for ${services?.priestTitle ?? 'the priest'} to lift your curses. You have ${formatCurrency(playerFundsCp)}.`;
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

    const defaultSuccess = `Divine power shatters the foul bindings on: ${cleansedNames.join(', ')}! The items are now safely stored in your pack.`;
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

    services ??= TempleService.manifestServices(engineOrWorldState);
    const gate = TempleService.applyTempleStanding(player, costCp, services, engineOrWorldState);
    if (gate.refusal) {
      return gate.refusal;
    }
    costCp = gate.costCp;

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
      'The priest bathes you in healing light! All afflictions are cured, and your HP and Mana are fully restored!';
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
    const sageName = services?.sageName ?? services?.sageTitle ?? 'The sage';

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
    const bankerTitle = services?.bankerTitle ?? 'The banker';
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

/**
 * Companions & Pet Progression, Phase 2 (docs/architecture/content-companions.md): trainer NPC
 * (`NpcRole: 'trainer'`) services — the acquisition gate, archetype switching,
 * skill teaching, and revival. Mirrors `TempleService`/`SageService`'s cost-check-
 * then-mutate pattern. Uses the literal `'companion_bonded'` world-state flag key
 * rather than `GameEngine.COMPANION_BONDED_FLAG` — `GameEngine` is imported
 * type-only here, so its static value isn't accessible; keep the two in sync if
 * either changes.
 */
export class TrainerService {
  public static readonly BOND_COST_CP = 100 * COIN_VALUES.gold; // 100 GP — one-time acquisition gate
  public static readonly REVIVE_COST_CP = 60 * COIN_VALUES.gold; // 60 GP
  public static readonly ARCHETYPE_SWITCH_COST_CP = 15 * COIN_VALUES.gold; // 15 GP
  public static readonly TEACH_SKILL_COST_CP = 40 * COIN_VALUES.gold; // 40 GP

  /** One-time purchase enabling `engine.summonCompanion()` going forward. */
  public static bondCompanion(engine: GameEngine, customCostCp?: number): ServiceResult {
    if (engine.getWorldFlag('companion_bonded')) {
      return { success: false, message: 'You have already bonded with a companion.', costInCp: 0 };
    }
    const costCp = customCostCp ?? TrainerService.BOND_COST_CP;
    const playerFundsCp = getPlayerTotalCp(engine.player);
    if (playerFundsCp < costCp) {
      return {
        success: false,
        message: `Bonding with a companion requires ${formatCurrency(costCp)}. You have ${formatCurrency(playerFundsCp)}.`,
        costInCp: costCp,
      };
    }
    const deduction = deductCurrencyFromPlayer(engine.player, costCp);
    if (!deduction.success) return deduction;

    engine.setWorldFlag('companion_bonded', true);
    return {
      success: true,
      message: 'A bond is forged. You may now summon your companion whenever you have need of it.',
      costInCp: costCp,
    };
  }

  /** Heals and re-attaches a fallen companion (`engine.deadCompanionRecord`), pack contents intact. */
  public static reviveCompanion(engine: GameEngine, customCostCp?: number): ServiceResult {
    if (engine.companion) {
      return { success: false, message: `${engine.companion.name} is already at your side.`, costInCp: 0 };
    }
    const dead = engine.deadCompanionRecord;
    if (!dead) {
      return { success: false, message: 'You have no fallen companion to revive.', costInCp: 0 };
    }
    const costCp = customCostCp ?? TrainerService.REVIVE_COST_CP;
    const playerFundsCp = getPlayerTotalCp(engine.player);
    if (playerFundsCp < costCp) {
      return {
        success: false,
        message: `Reviving ${dead.name} requires ${formatCurrency(costCp)}. You have ${formatCurrency(playerFundsCp)}.`,
        costInCp: costCp,
      };
    }
    const deduction = deductCurrencyFromPlayer(engine.player, costCp);
    if (!deduction.success) return deduction;

    dead.hp = dead.maxHp;
    dead.statusManager.clear();
    dead.aiState = 'hunting';
    engine.deadCompanionRecord = null;
    engine.attachCompanion(dead);
    return {
      success: true,
      message: `${dead.name} draws breath once more and returns to your side!`,
      costInCp: costCp,
    };
  }

  /** Switches the active companion's AI archetype (docs/architecture/content-companions.md Phase 2). */
  public static switchArchetype(
    engine: GameEngine,
    archetype: CompanionArchetype,
    customCostCp?: number
  ): ServiceResult {
    if (!engine.companion) {
      return { success: false, message: 'You have no companion here to train.', costInCp: 0 };
    }
    if (engine.companion.archetype === archetype) {
      return { success: false, message: `${engine.companion.name} is already trained as a ${archetype}.`, costInCp: 0 };
    }
    const costCp = customCostCp ?? TrainerService.ARCHETYPE_SWITCH_COST_CP;
    const playerFundsCp = getPlayerTotalCp(engine.player);
    if (playerFundsCp < costCp) {
      return {
        success: false,
        message: `Retraining ${engine.companion.name} as a ${archetype} requires ${formatCurrency(costCp)}. You have ${formatCurrency(playerFundsCp)}.`,
        costInCp: costCp,
      };
    }
    const deduction = deductCurrencyFromPlayer(engine.player, costCp);
    if (!deduction.success) return deduction;

    engine.companion.setArchetype(archetype);
    return {
      success: true,
      message: `${engine.companion.name} is retrained as a ${archetype}!`,
      costInCp: costCp,
    };
  }

  /** Unlocks an active companion skill by ID, if not already known. */
  public static teachSkill(
    engine: GameEngine,
    skillId: string,
    skillName?: string,
    customCostCp?: number
  ): ServiceResult {
    if (!engine.companion) {
      return { success: false, message: 'You have no companion here to train.', costInCp: 0 };
    }
    if (engine.companion.unlockedSkills.includes(skillId)) {
      return { success: false, message: `${engine.companion.name} already knows ${skillName ?? skillId}.`, costInCp: 0 };
    }
    const costCp = customCostCp ?? TrainerService.TEACH_SKILL_COST_CP;
    const playerFundsCp = getPlayerTotalCp(engine.player);
    if (playerFundsCp < costCp) {
      return {
        success: false,
        message: `Teaching ${skillName ?? skillId} requires ${formatCurrency(costCp)}. You have ${formatCurrency(playerFundsCp)}.`,
        costInCp: costCp,
      };
    }
    const deduction = deductCurrencyFromPlayer(engine.player, costCp);
    if (!deduction.success) return deduction;

    engine.companion.unlockSkill(skillId);
    return {
      success: true,
      message: `${engine.companion.name} learns ${skillName ?? skillId}!`,
      costInCp: costCp,
    };
  }
}
