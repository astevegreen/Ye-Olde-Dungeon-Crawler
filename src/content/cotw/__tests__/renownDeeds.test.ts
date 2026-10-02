import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { ItemFactory } from '../../../engine/items/factory';
import { addCurrencyToPlayer } from '../../../engine/economy/currency';
import { ExecuteChoiceAction } from '../../../engine/actions/choiceAction';
import { awardMilestone, getRenownTotal, hasEarnedMilestone } from '../../../engine/renown/renownLedger';
import { cotwManifest } from '../index';

function buildEngine(): GameEngine {
  const map = new GameMap(12, 8, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Sven', position: { x: 4, y: 3 }, stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 } });
  return new GameEngine({ map, player, floor: 0, manifest: cotwManifest });
}

describe('cotw renown: deeds reach the ledger', () => {
  // The Purifier milestone was recorded only by UncurseAction, which nothing in the game
  // dispatches: the temple's cleanse, the real way a curse is broken, earned nothing.
  it('breaking a curse at the temple earns the Purifier milestone', () => {
    const engine = buildEngine();
    engine.player.inventory.paperdoll.equip(ItemFactory.createCursedMace('cursed-1'), 'mainHand');
    addCurrencyToPlayer(engine.player, 50000);
    const before = getRenownTotal(engine, 'combat');
    expect(engine.commandBus.dispatch({ type: 'temple_cleanse' }).success).toBe(true);
    expect(getRenownTotal(engine, 'combat')).toBe(before + 15);
    // Nothing cursed: no cleanse, no renown.
    engine.commandBus.dispatch({ type: 'temple_cleanse' });
    expect(getRenownTotal(engine, 'combat')).toBe(before + 15);
  });

  it('a choice consequence records a milestone by id, totals and all', () => {
    const engine = buildEngine();
    const choice = {
      id: 't', title: 't', description: '',
      options: [{ id: 'o', label: 'o', consequences: [{ type: 'recordMilestone' as const, milestoneId: 'secret_door_found' }] }],
    };
    engine.handlePlayerAction(new ExecuteChoiceAction(engine.player, choice, 'o'));
    expect(getRenownTotal(engine, 'exploration')).toBe(5);
    expect(getRenownTotal(engine)).toBe(5);
  });

  it('content code awards its own definitions through awardMilestone, once unless repeatable', () => {
    const engine = buildEngine();
    const def = { id: 'test_deed', category: 'combat', label: 'Test Deed', renownValue: 20 };
    expect(awardMilestone(engine, def).awarded).toBe(true);
    expect(awardMilestone(engine, def).awarded).toBe(false);
    expect(hasEarnedMilestone(engine, 'test_deed')).toBe(true);
    expect(getRenownTotal(engine)).toBe(20);
  });
});
