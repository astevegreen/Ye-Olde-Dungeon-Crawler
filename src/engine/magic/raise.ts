import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Monster } from '../entities/monster';

/** Turns a raised foe fights for the hero when its curse sets none (`potency`). */
const DEFAULT_RISEN_TURNS = 20;

/**
 * Raising the slain (P-31): a foe that dies bearing `rises_when_slain` rises where it fell, on
 * the hero's side, for the curse's `potency` turns, then crumbles (the `risen` status). It is
 * a new creature from its definition, carrying nothing and worth nothing, so a second death
 * pays no loot. The quest's boss never rises; a pack makes others resist the curse through
 * `statusImmunities`.
 */
export function raiseSlain(engine: GameEngine, victim: Entity): void {
  if (!(victim instanceof Monster) || victim.faction !== 'hostile') return;
  const curse = victim.statusManager.getStatus('rises_when_slain');
  if (!curse || victim.definitionId === engine.manifest?.quest?.bossMonsterId) return;
  if (engine.map.getEntityAt(victim.x, victim.y)) return;

  let risen: Monster;
  try {
    risen = Monster.createFromDefinition(victim.definitionId, `risen_${victim.id}`, { x: victim.x, y: victim.y }, engine.registries);
  } catch {
    return;
  }
  risen.faction = 'player';
  risen.aiState = 'hunting';
  risen.lootTable = [];
  risen.xpValue = 0;
  if (!engine.addEntity(risen)) return;
  risen.statusManager.applyStatus({ type: 'risen', duration: curse.potency ?? DEFAULT_RISEN_TURNS, sourceEntityId: curse.sourceEntityId });
  engine.log(`${victim.name} rises again to fight at your side!`);
}
