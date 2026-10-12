import type { GameEngine } from '../../engine';
import { getNearbyThreats } from '../sidebar/sidebarModel';

/**
 * What changed around the hero since the menu last looked, so a menu that covers the map can
 * still raise the alarm. Turns pass while a menu is open (using an item costs one), and the
 * HUD that would show a monster or a wound is dimmed behind it. Presentation only: it reads
 * the engine and writes nothing back (ARCHITECTURE.md §3).
 */
export class MenuWatch {
  private hp: number | null = null;
  private floor: number | null = null;
  private seen = new Set<string>();

  /** Takes the state as it is now as the baseline; the next `check` reports only what is new. */
  public reset(engine: GameEngine): void {
    this.hp = engine.player.hp;
    this.floor = engine.currentFloor;
    this.seen = new Set(getNearbyThreats(engine).map((t) => t.id));
  }

  /** The warnings since the last call, oldest first: a wound, then each hostile that came into sight. */
  public check(engine: GameEngine): string[] {
    if (this.hp === null || this.floor !== engine.currentFloor) {
      this.reset(engine);
      return [];
    }
    const warnings: string[] = [];
    const lost = this.hp - engine.player.hp;
    if (lost > 0) warnings.push(`You lose ${lost} HP.`);
    const threats = getNearbyThreats(engine);
    for (const threat of threats) {
      if (!this.seen.has(threat.id)) warnings.push(`${/^[aeiou]/i.test(threat.name) ? 'An' : 'A'} ${threat.name} comes into view!`);
    }
    this.hp = engine.player.hp;
    this.seen = new Set(threats.map((t) => t.id));
    return warnings;
  }
}
