import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import type { Monster } from '../entities/monster';
import { Player } from '../entities/player';
import { productWorn, wornModifiers } from '../items/wornModifiers';

/**
 * One visit to the current floor: its number and the tick the hero last left it
 * (`GameMap.lastVisitedTick`, saved), so a floor revisited is a new visit. For effects that
 * work "once per floor" (tracker 3.6: Einherjar, Beast-Friend, Warding Glyph).
 */
export function floorVisitKey(engine: GameEngine): string {
  return `${engine.currentFloor}:${engine.map.lastVisitedTick ?? 0}`;
}

/** Spends an effect's use for this floor visit; false when it was already spent here. */
export function spendOncePerFloor(engine: GameEngine, effect: string): boolean {
  const flag = `${effect}@${floorVisitKey(engine)}`;
  if (engine.getWorldFlag(flag)) return false;
  engine.setWorldFlag(flag, true);
  return true;
}

/**
 * A death the hero's perks refuse, checked before `DeathResolver` resolves one: a hero
 * holding `lastStandPerFloor` (Einherjar) is left at 1 HP instead, once each floor visit, and
 * a companion whose hero holds `companionRisesPerFloor` (Beast-Friend) rises at full health,
 * once each floor visit.
 */
export function refusesDeath(engine: GameEngine, victim: Entity): boolean {
  if (victim instanceof Player) {
    const stand = wornModifiers(victim).find((mod) => mod.lastStandPerFloor);
    if (!stand || !spendOncePerFloor(engine, 'last_stand')) return false;
    victim.hp = 1;
    engine.log(`${victim.name} will not fall here! (${stand.name})`);
    return true;
  }
  if (victim === engine.companion && engine.player.isAlive()) {
    const bond = wornModifiers(engine.player).find((mod) => mod.companionRisesPerFloor);
    if (!bond || !spendOncePerFloor(engine, 'companion_rises')) return false;
    victim.hp = victim.maxHp;
    victim.statusManager.clear();
    engine.log(`${victim.name} falls, and rises again at your call! (${bond.name})`);
    return true;
  }
  return false;
}

/**
 * Raises a companion's max HP and attack by its hero's `companionStatMultiplier` (Beast-Friend),
 * once per companion: a saved world flag keeps a reload or a re-summon from compounding it.
 * Called at the start of the companion's turn, so a perk taken mid-floor or a newly bonded
 * companion takes effect on its next move.
 */
export function bondCompanion(engine: GameEngine, companion: Monster): void {
  const multiplier = productWorn(engine.player, 'companionStatMultiplier');
  if (multiplier === 1) return;
  const flag = `companion_bond:${companion.id}`;
  if (engine.getWorldFlag(flag)) return;
  engine.setWorldFlag(flag, true);
  const before = companion.maxHp;
  companion.maxHp = Math.round(before * multiplier);
  companion.attack = Math.round(companion.attack * multiplier);
  companion.hp = Math.min(companion.maxHp, companion.hp + (companion.maxHp - before));
}
