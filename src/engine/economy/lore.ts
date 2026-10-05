import type { GameEngine } from '../engine';
import type { MonsterDefinition } from '../bestiary/monsterDefinitions';
import type { ServiceResult } from './types';
import { deductCurrencyFromPlayer, formatCurrency, getPlayerTotalCp } from './currency';

/**
 * The sage's monster lore (tracker 4.1, `TownServicesDefinition.monsterLore`): Study raises a
 * known creature one bestiary rank; a Rumor reveals an unmet one the hero picks from a list.
 * Both are priced by the creature's home floor.
 */
export class LoreService {
  private static homeFloor(def: MonsterDefinition): number {
    return def.minFloor ?? 1;
  }

  private static monsters(engine: GameEngine): MonsterDefinition[] {
    return engine.registries.monsters.getAll();
  }

  /** Whether the pack's sage sells lore at all. */
  public static offered(engine: GameEngine): boolean {
    return !!engine.manifest.town?.services?.monsterLore;
  }

  public static studyPrice(engine: GameEngine, def: MonsterDefinition): number {
    const price = engine.manifest.town?.services?.monsterLore?.study;
    return price ? price.baseCp + price.perFloorCp * LoreService.homeFloor(def) : 0;
  }

  public static rumorPrice(engine: GameEngine, def: MonsterDefinition): number {
    const price = engine.manifest.town?.services?.monsterLore?.rumor;
    return price ? price.baseCp + price.perFloorCp * LoreService.homeFloor(def) : 0;
  }

  /** Known creatures whose page is not yet complete, nearest home floor first. */
  public static studyCandidates(engine: GameEngine): MonsterDefinition[] {
    const tier = (m: MonsterDefinition) => engine.compendium.getTier(m.id);
    return LoreService.byFloor(LoreService.monsters(engine).filter((m) => tier(m) > 0 && tier(m) < 3));
  }

  /** Unmet creatures that live on a dungeon floor, nearest home floor first. */
  public static rumorCandidates(engine: GameEngine): MonsterDefinition[] {
    return LoreService.byFloor(
      LoreService.monsters(engine).filter((m) => engine.compendium.getTier(m.id) === 0 && LoreService.homeFloor(m) >= 1)
    );
  }

  private static byFloor(list: MonsterDefinition[]): MonsterDefinition[] {
    return list.sort((a, b) => LoreService.homeFloor(a) - LoreService.homeFloor(b) || a.name.localeCompare(b.name));
  }

  private static sageName(engine: GameEngine): string {
    const services = engine.manifest.town?.services;
    return services?.sageName ?? services?.sageTitle ?? 'The sage';
  }

  /** Charges `price`, or says what is missing. */
  private static charge(engine: GameEngine, price: number, what: string): ServiceResult | undefined {
    const funds = getPlayerTotalCp(engine.player);
    if (funds < price) {
      return { success: false, costInCp: price, message: `${what} costs ${formatCurrency(price)}. You have ${formatCurrency(funds)}.` };
    }
    const paid = deductCurrencyFromPlayer(engine.player, price);
    return paid.success ? undefined : paid;
  }

  /** Raises a known creature one rank, for its Study price. */
  public static study(engine: GameEngine, definitionId: string): ServiceResult {
    const def = LoreService.studyCandidates(engine).find((m) => m.id === definitionId);
    if (!def || !LoreService.offered(engine)) {
      return { success: false, costInCp: 0, message: 'There is nothing more the sage can teach you of that creature.' };
    }
    const price = LoreService.studyPrice(engine, def);
    const refused = LoreService.charge(engine, price, `Studying the ${def.name}`);
    if (refused) return refused;
    const tier = engine.compendium.raiseKnowledge(def.id);
    const what = tier === 3 ? 'its page is complete' : 'you know its weaknesses now';
    return { success: true, costInCp: price, message: `${LoreService.sageName(engine)} opens the old tomes on the ${def.name}: ${what}.` };
  }

  /** Reveals an unmet creature the hero chose, for its Rumor price. */
  public static rumor(engine: GameEngine, definitionId: string): ServiceResult {
    const def = LoreService.rumorCandidates(engine).find((m) => m.id === definitionId);
    if (!def || !LoreService.offered(engine)) {
      return { success: false, costInCp: 0, message: 'You already know of that creature.' };
    }
    const price = LoreService.rumorPrice(engine, def);
    const refused = LoreService.charge(engine, price, `A rumor of floor ${LoreService.homeFloor(def)}`);
    if (refused) return refused;
    engine.compendium.revealByRumor(def.id, def.name);
    return {
      success: true,
      costInCp: price,
      message: `${LoreService.sageName(engine)} speaks low: on floor ${LoreService.homeFloor(def)} there walks the ${def.name}. It is in your bestiary now.`,
    };
  }
}
