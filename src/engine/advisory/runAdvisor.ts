import type { GameEngine } from '../engine';
import { Player } from '../entities/player';
import { getPlayerCoinItems, getPlayerTotalCp, formatCurrency } from '../economy/currency';
import { PotionItem, ScrollItem } from '../items/consumables';
import type { FloorHazardAdvisory, TownServicesDefinition } from '../types/manifest';

export type AdvisorySeverity = 'safe' | 'caution' | 'danger';

export interface AdvisoryWarning {
  type: 'bulk' | 'currency' | 'cursed' | 'consumables' | 'elemental';
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  recommendation: string;
}

export interface AdvisoryReport {
  overallStatus: AdvisorySeverity;
  summary: string;
  targetFloor: number;
  warnings: AdvisoryWarning[];
  sageQuote: string;
}

export class RunAdvisor {
  /**
   * Evaluates player's inventory weight and bulk capacity.
   * Warns if weight or volume exceeds 80% capacity.
   */
  public static checkInventoryBulk(player: Player): AdvisoryWarning | null {
    const pack = player.inventory.primaryPack;
    const currentWeight = typeof pack.containedWeight === 'function' ? pack.containedWeight() : pack.weight;
    const currentBulk = typeof pack.containedBulk === 'function' ? pack.containedBulk() : pack.bulk;
    const weightRatio = currentWeight / pack.maxWeightCapacity;
    const bulkRatio = currentBulk / pack.maxBulkCapacity;

    if (weightRatio >= 0.8 || bulkRatio >= 0.8) {
      const maxRatio = Math.max(weightRatio, bulkRatio);
      const percent = Math.round(maxRatio * 100);
      return {
        type: 'bulk',
        severity: percent >= 95 ? 'danger' : 'warning',
        title: 'Inventory Bulk Nearing Limit',
        message: `Backpack is currently at ${percent}% capacity (${(currentWeight / 1000).toFixed(1)}kg / ${(pack.maxWeightCapacity / 1000).toFixed(1)}kg weight, ${currentBulk}/${pack.maxBulkCapacity} bulk).`,
        recommendation: 'Deposit excess supplies or sell unneeded loot before descending to leave room for treasures.',
      };
    }

    return null;
  }

  /**
   * Evaluates loose currency burden.
   * Carrying over 5,000 CP worth of coins or heavy coin weight causes encumbrance risks.
   */
  public static checkLooseCurrency(player: Player, services?: TownServicesDefinition): AdvisoryWarning | null {
    const totalCp = getPlayerTotalCp(player);
    const coinItems = getPlayerCoinItems(player);
    const totalWeightGrams = coinItems.reduce((sum, c) => sum + (typeof c.item.totalWeight === 'function' ? c.item.totalWeight() : c.item.weight), 0);

    if (totalCp >= 5000 || totalWeightGrams >= 2000) {
      const banker = services?.bankerTitle ?? (services?.bankName ? `the ${services.bankName}` : 'the town banker');
      return {
        type: 'currency',
        severity: totalWeightGrams >= 4000 ? 'danger' : 'warning',
        title: 'Excessive Coin Burden',
        message: `You are carrying ${formatCurrency(totalCp)} in loose currency, weighing ${(totalWeightGrams / 1000).toFixed(2)}kg across ${coinItems.length} coin stacks.`,
        recommendation: `Visit ${banker} to exchange heavy copper and silver for compact gold and platinum pieces.`,
      };
    }

    return null;
  }

  /**
   * Evaluates equipped gear for dark curses.
   */
  public static checkCursedGear(player: Player, services?: TownServicesDefinition): AdvisoryWarning | null {
    const equipped = player.inventory.paperdoll.getAllEquipped();
    const cursed = equipped.filter(
      (e) => e.item.quality === 'cursed' || (typeof e.item.isCursed === 'function' && e.item.isCursed())
    );

    if (cursed.length > 0) {
      const names = cursed.map((e) => e.item.name).join(', ');
      const priest = services?.priestTitle ?? (services?.templeName ? `the priest at ${services.templeName}` : 'the town temple priest');
      return {
        type: 'cursed',
        severity: 'danger',
        title: 'Cursed Equipment Bound to Hero',
        message: `Malevolent dark magic binds cursed equipment to your limbs: ${names}.`,
        recommendation: `Seek ${priest} or read a Scroll of Remove Curse to cleanse the affliction.`,
      };
    }

    return null;
  }

  /**
   * Evaluates emergency recovery and mobility supplies for deeper floors (Floor 10+).
   */
  public static checkDeepFloorConsumables(player: Player, targetFloor: number): AdvisoryWarning | null {
    if (targetFloor < 10) {
      return null;
    }

    // Count healing consumables and escape scrolls across pack and belt
    const allItems = [
      ...player.inventory.primaryPack.getItems(),
      ...(player.inventory.belt ? player.inventory.belt.getItems() : []),
    ];

    let recoveryCount = 0;
    for (const item of allItems) {
      const name = item.name.toLowerCase();
      const isHealth =
        (item instanceof PotionItem && item.potionType === 'health') ||
        name.includes('health') ||
        name.includes('healing') ||
        name.includes('cure');
      const isEscape =
        (item instanceof ScrollItem && (item.spellId.includes('teleport') || item.spellId.includes('phase'))) ||
        name.includes('teleport') ||
        name.includes('phase') ||
        name.includes('recall');

      if (isHealth || isEscape) {
        recoveryCount += item.quantity ?? 1;
      }
    }

    if (recoveryCount < 2) {
      return {
        type: 'consumables',
        severity: recoveryCount === 0 ? 'danger' : 'warning',
        title: 'Insufficient Emergency Consumables',
        message: `You possess only ${recoveryCount} recovery/escape items while preparing for Floor ${targetFloor}.`,
        recommendation: 'Deep dungeon floors harbor relentless foes. Purchase at least 2 Health Potions or Teleport Scrolls before descending.',
      };
    }

    return null;
  }

  /**
   * Evaluates the upcoming floor's elemental hazard (the pack's `floorHazards` band
   * containing it) against the player's resistance to that element.
   */
  public static checkElementalPreparedness(
    player: Player,
    targetFloor: number,
    hazards: readonly FloorHazardAdvisory[] = []
  ): AdvisoryWarning | null {
    const hazard = hazards.find(
      (h) => targetFloor >= h.minFloor && (h.maxFloor === undefined || targetFloor <= h.maxFloor)
    );
    if (!hazard) {
      return null;
    }
    const res = player.elementalResistances[hazard.element];
    if (res && res !== 'neutral' && res !== 'weak') {
      return null;
    }
    return {
      type: 'elemental',
      severity: res === 'weak' && hazard.escalateWhenWeak !== false ? 'danger' : 'warning',
      title: hazard.title,
      message: hazard.message.replace('{floor}', String(targetFloor)),
      recommendation: hazard.recommendation,
    };
  }

  /**
   * Full comprehensive advisory evaluation.
   */
  public static evaluateRun(engine: GameEngine, customFloor?: number): AdvisoryReport {
    const player = engine.player;
    const targetFloor = customFloor ?? (engine.currentFloor === 0 ? 1 : engine.currentFloor);

    const warnings: AdvisoryWarning[] = [];

    const bulkWarn = this.checkInventoryBulk(player);
    if (bulkWarn) warnings.push(bulkWarn);

    const currWarn = this.checkLooseCurrency(player, engine.manifest?.town?.services);
    if (currWarn) warnings.push(currWarn);

    const curseWarn = this.checkCursedGear(player, engine.manifest?.town?.services);
    if (curseWarn) warnings.push(curseWarn);

    const consWarn = this.checkDeepFloorConsumables(player, targetFloor);
    if (consWarn) warnings.push(consWarn);

    const elemWarn = this.checkElementalPreparedness(player, targetFloor, engine.manifest?.floorHazards);
    if (elemWarn) warnings.push(elemWarn);

    let overallStatus: AdvisorySeverity = 'safe';
    if (warnings.some((w) => w.severity === 'danger')) {
      overallStatus = 'danger';
    } else if (warnings.some((w) => w.severity === 'warning')) {
      overallStatus = 'caution';
    }

    let summary = 'The runes smile upon your readiness. You are well equipped to brave the descent.';
    if (overallStatus === 'danger') {
      summary = 'Graves await the hasty! You are in perilous jeopardy and should heed the runes immediately.';
    } else if (overallStatus === 'caution') {
      const townName = engine.manifest?.town?.name ?? 'town';
      summary = `Caution is advised. A few prudent preparations in ${townName} will preserve your life below.`;
    }

    const defaultQuotes = [
      '"Steel sharpens steel, but forethought preserves the flesh."',
      '"Ancient lore tells of heroes felled not by monsters, but by an overfilled pack."',
      '"Fortune favors the brave, but only when they bring potions to battle."',
      '"He who descends unwarded into the frost will leave only bone for the ravens."',
    ];
    const sageQuotes = engine.manifest?.advisorQuotes ?? defaultQuotes;
    const sageQuote = sageQuotes[Math.floor(engine.rng() * sageQuotes.length)];

    return {
      overallStatus,
      summary,
      targetFloor,
      warnings,
      sageQuote,
    };
  }
}
