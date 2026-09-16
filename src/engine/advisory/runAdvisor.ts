import type { GameEngine } from '../engine';
import { Player } from '../entities/player';
import { getPlayerCoinItems, getPlayerTotalCp, formatCurrency } from '../economy/currency';
import { PotionItem, ScrollItem } from '../items/consumables';
import type { TownServicesDefinition } from '../types/manifest';

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
      const banker = services?.bankerTitle ?? (services?.bankName ? `the ${services.bankName}` : 'Banker Haakon');
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
      const priest = services?.priestTitle ?? (services?.templeName ? `the priest at ${services.templeName}` : 'Father Torvald at the Temple of Thor');
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
        recommendation: 'Deep dungeon floors harbor relentless foes. Purchase at least 2 Health Potions or Teleport Scrolls from Astrid\'s Alchemy.',
      };
    }

    return null;
  }

  /**
   * Evaluates elemental hazards on the upcoming floor against equipped player resistances.
   */
  public static checkElementalPreparedness(player: Player, targetFloor: number): AdvisoryWarning | null {
    if (targetFloor < 8) {
      return null;
    }

    // Floors 8-24: Cold and Frost hazards
    if (targetFloor >= 8 && targetFloor <= 24) {
      const res = player.elementalResistances.cold;
      if (!res || res === 'neutral' || res === 'weak') {
        return {
          type: 'elemental',
          severity: res === 'weak' ? 'danger' : 'warning',
          title: 'Vulnerable to Glacial Frost',
          message: `The icy caverns of Floor ${targetFloor} harbor frost drakes and winter wolves.`,
          recommendation: 'Equip cold-warding shields or brew frost-resist elixirs to avoid crippling freeze damage.',
        };
      }
    }

    // Floors 25-36: Fire and Inferno hazards
    if (targetFloor >= 25 && targetFloor <= 36) {
      const res = player.elementalResistances.fire;
      if (!res || res === 'neutral' || res === 'weak') {
        return {
          type: 'elemental',
          severity: res === 'weak' ? 'danger' : 'warning',
          title: 'Vulnerable to Scorching Flame',
          message: `Floor ${targetFloor} descends into molten chasms with fire elementals and hell hounds.`,
          recommendation: 'Equip flame-resistant plate armor or charms of fire protection before crossing the threshold.',
        };
      }
    }

    // Floors 37+: Chieftain & Dragon lightning/elemental devastation
    if (targetFloor >= 37) {
      const res = player.elementalResistances.lightning;
      if (!res || res === 'neutral' || res === 'weak') {
        return {
          type: 'elemental',
          severity: 'warning',
          title: 'Vulnerable to Storm Tempest',
          message: `The summit depths of Floor ${targetFloor} crackle with Jotun lightning and thunderous strikes.`,
          recommendation: 'Acquire lightning-resistant gear and warding runes from high-tier smiths or deep vaults.',
        };
      }
    }

    return null;
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

    const elemWarn = this.checkElementalPreparedness(player, targetFloor);
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
