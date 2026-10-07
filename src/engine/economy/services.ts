import type { Player } from '../entities/player';
import type { Item } from '../items/item';
import type { TempleBlessingDefinition, TownServicesDefinition } from '../types/manifest';
import {
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
import { depositToVault, getFaction, getFlag, getVaultItems, modifyFaction, removeFromVault, type WorldState } from '../state/worldState';
import { getRenownTotal, recordMilestone } from '../renown/renownLedger';
import { familyModifier } from '../items/modifierRoller';
import { RunAdvisor, type AdvisoryReport } from '../advisory/runAdvisor';
import type { CompanionArchetype } from '../entities/companion';
import { growCompanion } from '../combat/lastStand';

export class TempleService {
  // On the shop's copper scale (Q45, 2026-10-04): a floor-1 full clear pays about 400 CP.
  public static readonly CURSE_CLEANSE_COST_CP = 300;
  public static readonly HEAL_RESTORE_COST_CP = 100;

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

  /** True while the hero wears something the temple will not serve past a cleansing (`ItemModifier.templeShunned`). */
  private static wearsShunned(player: Player): boolean {
    return player.inventory.paperdoll.getEquippedItems().some((item) => item.modifiers.some((m) => m.templeShunned));
  }

  /**
   * Cleanses and unbinds all cursed items equipped on the player's paperdoll. A shunned
   * item (Hel-touched) is cleansed too, at double the price.
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
    // The cleanse is never refused (Q50): a hero the temple would turn away, like one wearing
    // Hel's mark, pays double for it; the two don't stack.
    const gate = TempleService.applyTempleStanding(player, costCp, services, engineOrWorldState);
    if (!gate.refusal) costCp = gate.costCp;
    if (gate.refusal || TempleService.wearsShunned(player)) costCp *= 2;

    const equipped = player.inventory.paperdoll.getAllEquipped();
    const cursedItems = equipped.filter((e) => e.item.isBound());

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

    // Take the binding family off each item; it goes to the pack if it fits, else stays worn.
    const cleansedNames: string[] = [];
    const stillWorn: string[] = [];
    for (const entry of cursedItems) {
      entry.item.uncurse();
      entry.item.identified = true;
      cleansedNames.push(entry.item.name);
      if (player.inventory.primaryPack.canContain(entry.item).allowed) {
        player.inventory.paperdoll.unequip(entry.slot);
        player.inventory.primaryPack.addItem(entry.item);
      } else {
        stillWorn.push(entry.item.name);
      }
    }

    const placement =
      stillWorn.length === 0
        ? 'The items are now safely stored in your pack.'
        : `Your pack has no room, so you still wear ${stillWorn.join(', ')}, free of the curse.`;
    const message = services?.cleanseMessageTemplate
      ? `${services.cleanseMessageTemplate
          .replace('{items}', cleansedNames.join(', '))
          .replace('{item}', cleansedNames.join(', '))} ${placement}`
      : `Divine power shatters the foul bindings on: ${cleansedNames.join(', ')}! ${placement}`;

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
    if (TempleService.wearsShunned(player)) {
      return {
        success: false,
        costInCp: 0,
        message:
          services?.templeShunnedMessage ??
          `${services?.priestTitle ?? 'The priest'} will not lay hands on you while you wear that. Only a cleansing, at double the price.`,
      };
    }

    if (TempleService.healingIsFree(services, worldStateOf(engineOrWorldState))) costCp = 0;

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
    if (costCp > 0) {
      const deduction = deductCurrencyFromPlayer(player, costCp);
      if (!deduction.success) {
        return deduction;
      }
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

  // ---- Offerings and blessings (tracker 2.6: Q9, Q34, Q49, Q50) ----------------------------

  /** The world flag a granted blessing leaves. */
  private static blessingFlag(id: string): string {
    return `temple_blessing:${id}`;
  }

  /** True once a `freeHealing` blessing has been granted. */
  private static healingIsFree(services: TownServicesDefinition | undefined, worldState: WorldState | undefined): boolean {
    if (!worldState) return false;
    return (services?.templeBlessings ?? []).some((b) => b.effect.type === 'freeHealing' && getFlag(worldState, TempleService.blessingFlag(b.id)));
  }

  private static standingOf(engine: GameEngine): number {
    return getFaction(engine.worldState, engine.manifest.town?.services?.templeStandingFaction ?? 'temple_standing');
  }

  /** The hero's piety: renown in the pack's piety category. */
  public static piety(engine: GameEngine): number {
    return getRenownTotal(engine, engine.manifest.town?.services?.pietyCategory ?? 'piety');
  }

  /** What the hero may offer: identified items in the pack carrying an accepted family. */
  public static offerableItems(engine: GameEngine): Item[] {
    const offerings = engine.manifest.town?.services?.templeOfferings;
    if (!offerings) return [];
    return engine.player.inventory.primaryPack
      .getItems()
      .filter((item) => item.identified && item.modifiers.some((m) => offerings.alignments.includes(m.alignment)));
  }

  /** Takes an item from the pack as an offering: no coin, piety (its milestone) and standing. */
  public static makeOffering(engine: GameEngine, item: Item): ServiceResult {
    const services = engine.manifest.town?.services;
    const offerings = services?.templeOfferings;
    const priest = services?.priestTitle ?? 'The priest';
    if (!offerings) return { success: false, costInCp: 0, message: `${priest} takes no offerings.` };
    if (TempleService.wearsShunned(engine.player)) {
      return { success: false, costInCp: 0, message: services?.templeShunnedMessage ?? `${priest} will take nothing from you while you wear that.` };
    }
    if (!TempleService.offerableItems(engine).includes(item)) {
      return { success: false, costInCp: 0, message: `${priest} takes only cursed things you know for what they are, from your pack.` };
    }
    engine.player.inventory.primaryPack.removeItem(item.id);
    recordMilestone(engine, offerings.milestoneId);
    if (offerings.standingDelta) {
      modifyFaction(engine.worldState, services?.templeStandingFaction ?? 'temple_standing', offerings.standingDelta);
    }
    const message = (offerings.messageTemplate ?? `${priest} takes {item} from you and gives it to the fire.`).replace('{item}', item.displayName);
    return { success: true, costInCp: 0, message };
  }

  /** Blessings the hero may receive now: not yet granted, and the piety reached. */
  public static availableBlessings(engine: GameEngine): TempleBlessingDefinition[] {
    const piety = TempleService.piety(engine);
    return (engine.manifest.town?.services?.templeBlessings ?? []).filter(
      (b) => piety >= b.minPiety && !engine.getWorldFlag(TempleService.blessingFlag(b.id))
    );
  }

  /** What a `hallowItem` blessing may take: carried or worn, identified, of its categories, with no family. */
  public static hallowableItems(engine: GameEngine, blessingId: string): Item[] {
    const blessing = engine.manifest.town?.services?.templeBlessings?.find((b) => b.id === blessingId);
    if (blessing?.effect.type !== 'hallowItem') return [];
    const { categories } = blessing.effect;
    const inventory = engine.player.inventory;
    return [...inventory.primaryPack.getItems(), ...inventory.paperdoll.getAllEquipped().map((e) => e.item)].filter(
      (item) => item.identified && item.quality !== 'artifact' && item.modifiers.length === 0 && categories.includes(item.category)
    );
  }

  /** Grants a blessing once, free; `item` is the one a `hallowItem` blessing acts on. */
  public static receiveBlessing(engine: GameEngine, blessingId: string, item?: Item): ServiceResult {
    const services = engine.manifest.town?.services;
    const priest = services?.priestTitle ?? 'The priest';
    const blessing = TempleService.availableBlessings(engine).find((b) => b.id === blessingId);
    if (!blessing) return { success: false, costInCp: 0, message: 'That blessing is not yours to receive.' };
    if (TempleService.standingOf(engine) < 0) {
      return { success: false, costInCp: 0, message: services?.templeRefusalMessage ?? `${priest} refuses to serve you.` };
    }
    if (TempleService.wearsShunned(engine.player)) {
      return { success: false, costInCp: 0, message: services?.templeShunnedMessage ?? `${priest} will not lay hands on you while you wear that.` };
    }

    const effect = blessing.effect;
    let itemName = '';
    if (effect.type === 'hallowItem') {
      const families = engine.manifest.itemFamilies;
      if (!item || !families || !TempleService.hallowableItems(engine, blessing.id).includes(item)) {
        return { success: false, costInCp: 0, message: `Choose a plain piece of gear for ${blessing.name}.` };
      }
      const counter = engine.manifest.deepestFloorCounter;
      const depth = Math.max(1, counter ? engine.getWorldCounter(counter) : engine.currentFloor);
      const modifier = familyModifier(families, effect.family, depth, item.id);
      if (!modifier) return { success: false, costInCp: 0, message: `${priest} cannot hallow that.` };
      item.addModifier(modifier);
      itemName = item.displayName;
    } else if (effect.type === 'maxHpPercent') {
      const before = engine.player.maxHp;
      engine.player.maxHpPercentBonus += effect.percent;
      engine.player.hp += engine.player.maxHp - before;
    }
    engine.setWorldFlag(TempleService.blessingFlag(blessing.id), true);
    const message = (blessing.message ?? `${priest} grants you ${blessing.name}.`).replace('{item}', itemName);
    return { success: true, costInCp: 0, message };
  }
}

/** The world state behind a service call's engine-or-state argument. */
function worldStateOf(engineOrWorldState?: GameEngine | WorldState): WorldState | undefined {
  return engineOrWorldState && 'worldState' in engineOrWorldState ? engineOrWorldState.worldState : (engineOrWorldState as WorldState | undefined);
}

export class SageService {
  /** About an Identify scroll's price (40 CP) (Q45). */
  public static readonly IDENTIFY_FEE_CP = 50;

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
   * Evaluates the hero's readiness for the floor it faces (`RunAdvisor.evaluateRun`) and
   * returns strategic run advisory.
   */
  public static getRunAdvisory(engine: GameEngine): AdvisoryReport {
    return RunAdvisor.evaluateRun(engine);
  }
}

export class BankService {
  /** The bank's stash: items the hero leaves in town between delves (`WorldState.remoteVaults`). */
  public static readonly STASH_VAULT_ID = 'bank_stash';
  public static readonly STASH_CAPACITY = 40;

  /** What the bank keeps for the hero, oldest first. */
  public static stashedItems(engine: GameEngine): Item[] {
    return getVaultItems(engine.worldState, BankService.STASH_VAULT_ID);
  }

  /** What the hero may leave: anything loose in the pack but coins (the exchange's business) and quest items. */
  public static stashableItems(engine: GameEngine): Item[] {
    return engine.player.inventory.primaryPack.getItems().filter((i) => i.category !== 'currency' && i.category !== 'quest');
  }

  /** Leaves one pack item, whole stack and contents, with the bank. Free, and no turn passes. */
  public static stashItem(engine: GameEngine, itemId: string): ServiceResult {
    const item = BankService.stashableItems(engine).find((i) => i.id === itemId);
    if (!item) return { success: false, message: 'Choose something from your pack to leave.', costInCp: 0 };
    if (BankService.stashedItems(engine).length >= BankService.STASH_CAPACITY) {
      return { success: false, message: `The bank keeps no more than ${BankService.STASH_CAPACITY} of your things. Take something back first.`, costInCp: 0 };
    }
    engine.player.inventory.primaryPack.removeItem(item.id);
    depositToVault(engine.worldState, BankService.STASH_VAULT_ID, item);
    return { success: true, message: `You leave ${item.displayName} with the bank.`, costInCp: 0 };
  }

  /** Takes a stashed item back into the pack, if the pack has room for it. */
  public static withdrawItem(engine: GameEngine, itemId: string): ServiceResult {
    const item = BankService.stashedItems(engine).find((i) => i.id === itemId);
    if (!item) return { success: false, message: 'The bank keeps nothing like that for you.', costInCp: 0 };
    if (!engine.player.inventory.primaryPack.addItem(item)) {
      return { success: false, message: `Your pack has no room for ${item.displayName}.`, costInCp: 0 };
    }
    removeFromVault(engine.worldState, BankService.STASH_VAULT_ID, item);
    return { success: true, message: `You take ${item.displayName} back from the bank.`, costInCp: 0 };
  }

  /**
   * Exchanges all the hero's coins for the fewest coins of the same value, free. Coins take
   * space, not weight, so this is how a hero fits more value in the purse.
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

    const coinsBefore = getPlayerCoinItems(player);
    const countBefore = coinsBefore.reduce((sum, c) => sum + c.parsed.count, 0);
    const compacted = breakdownChange(totalCp);
    const countAfter = compacted.gold + compacted.silver + compacted.copper;

    if (countAfter >= countBefore) {
      return {
        success: false,
        message: `Your coins are already the fewest that make ${formatCurrency(totalCp)}.`,
        costInCp: 0,
      };
    }

    for (const { container, item } of coinsBefore) {
      container.removeItem(item.id);
    }
    // The purse first, then the pack.
    addCurrencyToPlayer(player, compacted);

    const bankerTitle = services?.bankerTitle ?? 'The banker';
    const defaultMsg = `${bankerTitle} exchanged your ${countBefore} coins for ${countAfter} worth the same ${formatCurrency(totalCp)}.`;
    const message = services?.compactionMessageTemplate
      ? services.compactionMessageTemplate
          .replace('{coins}', formatCurrency(totalCp))
          .replace('{oldCount}', countBefore.toString())
          .replace('{newCount}', countAfter.toString())
      : defaultMsg;

    return {
      success: true,
      message,
      costInCp: 0,
      coinsSaved: countBefore - countAfter,
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
  // On the shop's copper scale (Q45, 2026-10-04).
  public static readonly BOND_COST_CP = 1000; // one-time acquisition gate
  public static readonly REVIVE_COST_CP = 500;
  public static readonly ARCHETYPE_SWITCH_COST_CP = 150;
  public static readonly TEACH_SKILL_COST_CP = 400;

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
    growCompanion(engine, dead);
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
