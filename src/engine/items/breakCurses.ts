import type { GameEngine } from '../engine';
import type { Entity } from '../entities/entity';
import { Actor } from '../entities/actor';
import type { EquipmentSlot, Item } from './item';
import { recordMilestone } from '../renown/renownLedger';

/** One item to cleanse, by worn slot or by id; none means everything the actor carries. */
export interface UncurseTarget {
  slot?: EquipmentSlot;
  itemId?: string;
}

/**
 * Breaks the curses on an actor's items: one item when `target` names it, else everything
 * worn and carried. Each item freed emits an `uncurse` event, and freeing any records the
 * `item_uncursed` milestone, as the temple's cleanse does. The `uncurse` spell effect calls
 * this (a pack's Remove Curse scroll or spell); it spends no energy itself, since the cast
 * that runs it already has. Returns the items freed.
 */
export function breakCurses(engine: GameEngine, actor: Entity, target?: UncurseTarget): Item[] {
  // Only actors carry inventories; a plain entity has nothing to uncurse.
  const inventory = actor instanceof Actor ? actor.inventory : undefined;
  const freed: Item[] = [];
  if (!inventory) return freed;

  const tryUncurse = (item: Item | null | undefined): void => {
    if (!item || !(item.isBound() || item.isCursed())) return;
    const res = item.uncurse();
    if (!res.uncursed) return;
    freed.push(item);
    engine.emitGameEvent({
      type: 'uncurse',
      turn: engine.turnCount,
      actorId: actor.id,
      itemId: item.id,
      removedModifiers: res.removedModifiers,
    });
  };

  if (target?.slot) {
    tryUncurse(inventory.paperdoll.getItem(target.slot));
  } else if (target?.itemId) {
    tryUncurse(inventory.findItemById(target.itemId));
  } else {
    for (const worn of inventory.paperdoll.getEquippedItems()) tryUncurse(worn);
    for (const carried of inventory.primaryPack.getItems()) tryUncurse(carried);
  }

  if (freed.length === 0) {
    engine.log(`${actor.name} invokes purifying power, but no cursed items were found.`);
    return freed;
  }
  engine.log(`Purifying light envelops ${actor.name}! The curse on ${freed.map((i) => i.name).join(', ')} has been broken!`);
  recordMilestone(engine, 'item_uncursed');
  return freed;
}
