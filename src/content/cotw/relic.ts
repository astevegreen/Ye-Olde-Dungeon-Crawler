import type { ActionHook, Item } from '../../engine';
import { Container } from '../../engine';

/** Act 1's plot device: the stolen shard of Sól's sun-chariot (quest.ts). */
export const HEARTH_TEAR_ID = 'hearth_tear_fragment';
/** Set once the hero first holds the Hearth-Tear: the "Hearth-Tear Reclaimed" milestone. */
export const RELIC_RECOVERED_FLAG = 'relic_recovered';
/** Set when the hero first reaches Bjarnarhaven with it: the Great Thaw (narrative.ts). */
export const HEARTH_TEAR_RETURNED_FLAG = 'hearth_tear_returned';

function holds(items: readonly Item[], definitionId: string): boolean {
  return items.some((i) => i.definitionId === definitionId || (i instanceof Container && holds(i.getItems(), definitionId)));
}

/**
 * Marks the Hearth-Tear recovered once the hero carries it. It runs after every action
 * rather than on the pickup itself, since loot can also arrive through the inventory's
 * own transfers; the next turn after picking it up is soon enough.
 */
export const COTW_RELIC_HOOK: ActionHook = {
  id: 'cotw-hearth-tear-recovered',
  phase: 'post',
  actionType: '*',
  execute: ({ actor, engine }) => {
    if (actor !== engine.player || engine.getWorldFlag(RELIC_RECOVERED_FLAG)) return;
    const inv = engine.player.inventory;
    const carried = [...inv.primaryPack.getItems(), ...inv.paperdoll.getAllEquipped().map((e) => e.item)];
    if (holds(carried, HEARTH_TEAR_ID)) {
      engine.setWorldFlag(RELIC_RECOVERED_FLAG, true);
      engine.log('The Hearth-Tear is yours. Carry it home, and Bjarnarhaven will be warm again.');
    }
  },
};
