import type { GameEngine } from '../engine';
import type { Monster } from '../entities/monster';
import { lowestWorn } from '../items/wornModifiers';
import { familyModifiers } from '../compendium/familyPerks';

/**
 * Whether a sleeping monster wakes on seeing the hero (Q57 "A", ADR-0014): always, unless the
 * hero holds a wake radius, from what it wears and holds (`wakeRadius`, Shadow-Walker) or from
 * its family perk against the monster's family (Reaver), and the monster is farther off than
 * that (Chebyshev tiles). Damage and alarms still wake it; this is only the sight check, asked
 * by `GameEngine.updateFov` and `MonsterAI.decideAction` through `Monster.wakesOnSight`.
 */
export function wakesOnSight(engine: GameEngine, monster: Monster): boolean {
  const radii = [lowestWorn(engine.player, 'wakeRadius'), ...familyModifiers(engine, engine.player, monster).map((mod) => mod.wakeRadius)].filter(
    (r): r is number => r !== undefined
  );
  if (radii.length === 0) return true;
  const distance = Math.max(Math.abs(monster.x - engine.player.x), Math.abs(monster.y - engine.player.y));
  return distance <= Math.min(...radii);
}
