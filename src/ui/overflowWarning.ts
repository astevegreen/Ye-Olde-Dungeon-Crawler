import { getOverflowConfig, resolveManaTerms, type GameEngine } from '../engine';

/**
 * The warning before the first cast into overflow on each floor (N38): in a pack whose
 * spells can be cast short of mana, the shortfall becomes debt and may set off a surge.
 * The first short cast on a floor is held back with a line saying so; casting again goes
 * ahead, and later short casts on that floor go ahead at once. Presentation state: it
 * changes no game state and is not saved.
 */
export class OverflowWarning {
  private readonly warnedFloors = new Set<number>();

  /** The warning to show instead of casting, or null to let the cast go ahead. */
  public check(engine: GameEngine, cost: number): string | null {
    const overflow = getOverflowConfig(engine);
    const short = cost - engine.player.mana;
    if (!overflow || short <= 0 || this.warnedFloors.has(engine.currentFloor)) return null;
    this.warnedFloors.add(engine.currentFloor);
    const mana = resolveManaTerms(engine.manifest);
    return `You are ${short} ${mana.unit} short: this cast draws the rest as ${overflow.debtName}, and the overflow may surge. Cast again to go ahead.`;
  }

  /** A new game or a load: every floor warns again. */
  public reset(): void {
    this.warnedFloors.clear();
  }
}
