import { getOverflowConfig, resolveManaTerms, wearsFlag, type GameEngine } from '../engine';

/**
 * The warnings before a cast into overflow: in a pack whose spells can be cast short of
 * mana, the shortfall becomes debt and may set off a surge.
 * - The first short cast on each floor is held back with a line saying so (N38).
 * - A short cast that would carry the debt into the pack's worst tier is held back every
 *   time, whatever the floor (magic review, action item 8).
 * Casting again goes ahead. Presentation state: it changes no game state and is not saved.
 */
export class OverflowWarning {
  private readonly warnedFloors = new Set<number>();
  /** The floor and debt of the last worst-tier warning; the same cast again goes ahead. */
  private armedWorst: string | null = null;

  /** The warning to show instead of casting, or null to let the cast go ahead. */
  public check(engine: GameEngine, cost: number): string | null {
    const overflow = getOverflowConfig(engine);
    const short = cost - engine.player.mana;
    if (!overflow || short <= 0) return null;
    const floor = engine.currentFloor;
    const mana = resolveManaTerms(engine.manifest);

    const worst = overflow.tiers[overflow.tiers.length - 1];
    const debt = engine.player.voidDebt ?? 0;
    const next = debt + short;
    const accrues = !wearsFlag(engine.player, 'overflowNoDebt');
    if (worst && accrues && debt < worst.minDebt && next >= worst.minDebt) {
      this.warnedFloors.add(floor);
      const key = `${floor}:${debt}`;
      if (this.armedWorst === key) {
        this.armedWorst = null;
        return null;
      }
      this.armedWorst = key;
      const lingers = overflow.lingeringDebt !== undefined && next >= overflow.lingeringDebt;
      return `You are ${short} ${mana.unit} short: this cast takes ${overflow.debtName} from ${debt} to ${next}, into ${worst.label}${lingers ? ', and resting in the dungeon will not lower it' : ''}. Cast again to go ahead.`;
    }

    if (this.warnedFloors.has(floor)) return null;
    this.warnedFloors.add(floor);
    return `You are ${short} ${mana.unit} short: this cast draws the rest as ${overflow.debtName}, and the overflow may surge. Cast again to go ahead.`;
  }

  /** A new game or a load: every floor warns again. */
  public reset(): void {
    this.warnedFloors.clear();
    this.armedWorst = null;
  }
}
