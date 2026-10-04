import type { GameEngine } from '../engine';
import type { Item } from '../items/item';
import type { SmithDefinition } from '../types/manifest';
import type { ServiceResult } from './types';
import { deductCurrencyFromPlayer, formatCurrency, getPlayerTotalCp } from './currency';
import { evaluatePredicate } from '../predicates/predicateEvaluator';

/**
 * Smiths (tracker 2.7, `TownServicesDefinition.smiths`): a step at a time up a pack's price
 * list, or a one-time masterwork straight to a level. A step is worth what a dungeon +N is
 * (`createScaledItem`): +2 attack on a weapon, +1 defense on anything else.
 */
export class SmithService {
  public static smithFor(engine: GameEngine, npcId: string): SmithDefinition | undefined {
    return engine.manifest.town?.services?.smiths?.find((s) => s.npcId === npcId);
  }

  /** What the smith could work on: carried or worn, identified, unbound, of the smith's categories. */
  private static candidates(engine: GameEngine, smith: SmithDefinition): Item[] {
    const inventory = engine.player.inventory;
    return [...inventory.primaryPack.getItems(), ...inventory.paperdoll.getAllEquipped().map((e) => e.item)].filter(
      (item) => item.identified && !item.isBound() && smith.categories.includes(item.category)
    );
  }

  /** Items the smith can raise a step now. */
  public static workableItems(engine: GameEngine, npcId: string): Item[] {
    const smith = SmithService.smithFor(engine, npcId);
    if (!smith) return [];
    return SmithService.candidates(engine, smith).filter((item) => item.enchantmentLevel < smith.stepPricesCp.length);
  }

  /** The price of the item's next step; undefined past the smith's last. */
  public static nextStepPrice(engine: GameEngine, npcId: string, item: Item): number | undefined {
    return SmithService.smithFor(engine, npcId)?.stepPricesCp[item.enchantmentLevel];
  }

  /** Raises the item one step, for the step's price. */
  public static upgrade(engine: GameEngine, npcId: string, item: Item): ServiceResult {
    const smith = SmithService.smithFor(engine, npcId);
    if (!smith || !SmithService.workableItems(engine, npcId).includes(item)) {
      return { success: false, costInCp: 0, message: `That is not work for this forge: it must be known, free of curses, and below +${smith?.stepPricesCp.length ?? 0}.` };
    }
    const price = smith.stepPricesCp[item.enchantmentLevel];
    const funds = getPlayerTotalCp(engine.player);
    if (funds < price) {
      return { success: false, costInCp: price, message: `Raising ${item.displayName} costs ${formatCurrency(price)}. You have ${formatCurrency(funds)}.` };
    }
    const paid = deductCurrencyFromPlayer(engine.player, price);
    if (!paid.success) return paid;
    applyEnchantmentLevel(item, item.enchantmentLevel + 1);
    const message = (smith.messageTemplate ?? 'The smith works your steel: {item}.').replace('{item}', item.displayName);
    return { success: true, costInCp: price, message };
  }

  /** True while the smith's masterwork is on offer (its predicate holds, its flag unset). */
  public static masterworkAvailable(engine: GameEngine, npcId: string): boolean {
    const work = SmithService.smithFor(engine, npcId)?.masterwork;
    return !!work && !engine.getWorldFlag(work.flag) && evaluatePredicate(work.predicate, engine.worldState);
  }

  /** Items the masterwork could take: as for a step, but anything below its level. */
  public static masterworkItems(engine: GameEngine, npcId: string): Item[] {
    const smith = SmithService.smithFor(engine, npcId);
    const work = smith?.masterwork;
    if (!smith || !work) return [];
    return SmithService.candidates(engine, smith).filter((item) => item.enchantmentLevel < work.toLevel);
  }

  /** The one-time masterwork: the item straight to its level, free. */
  public static masterwork(engine: GameEngine, npcId: string, item: Item): ServiceResult {
    const work = SmithService.smithFor(engine, npcId)?.masterwork;
    if (!work || !SmithService.masterworkAvailable(engine, npcId)) {
      return { success: false, costInCp: 0, message: 'That work is not on offer.' };
    }
    if (!SmithService.masterworkItems(engine, npcId).includes(item)) {
      return { success: false, costInCp: 0, message: `Choose a known, uncursed piece below +${work.toLevel} for ${work.name}.` };
    }
    applyEnchantmentLevel(item, work.toLevel);
    engine.setWorldFlag(work.flag, true);
    return { success: true, costInCp: 0, message: work.message.replace('{item}', item.displayName) };
  }
}

/** Sets an item's +N and moves its stats and worth with it, as `createScaledItem` scales them. */
function applyEnchantmentLevel(item: Item, level: number): void {
  const steps = level - item.enchantmentLevel;
  if (item.category === 'weapon') item.stats.attackBonus = (item.stats.attackBonus ?? 0) + steps * 2;
  else item.stats.defenseBonus = (item.stats.defenseBonus ?? 0) + steps;
  item.enchantmentLevel = level;
  item.value = Math.round(item.baseValue * (1 + level * 0.4) + (item.elementalAffix ? 150 : 0));
}
