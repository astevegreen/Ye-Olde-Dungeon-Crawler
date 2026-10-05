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
import { MovementAction } from '../../../engine/actions/movement';
import { SearchAction } from '../../../engine/actions/search';
import { TrapInstance } from '../../../engine/dungeon/traps';
import { TileInspector } from '../../../engine/inspect/inspector';
import { COTW_RENOWN_MILESTONES } from '../renown';

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
    const before = getRenownTotal(engine, 'piety');
    expect(engine.commandBus.dispatch({ type: 'temple_cleanse' }).success).toBe(true);
    expect(getRenownTotal(engine, 'piety')).toBe(before + 15);
    // Nothing cursed: no cleanse, no renown.
    engine.commandBus.dispatch({ type: 'temple_cleanse' });
    expect(getRenownTotal(engine, 'piety')).toBe(before + 15);
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

  it('every milestone a cotw choice records is one the pack defines', () => {
    const ids = new Set(COTW_RENOWN_MILESTONES.map((m) => m.id));
    const named: string[] = [];
    for (const choice of Object.values(cotwManifest.choices ?? {})) {
      for (const option of choice.options) {
        for (const c of option.consequences) if (c.type === 'recordMilestone') named.push(c.milestoneId);
      }
    }
    expect(named.length).toBeGreaterThan(15);
    for (const id of named) expect(ids.has(id), id).toBe(true);
    // No deed bypasses the ledger with a bare renown counter any more.
    const bare = Object.values(cotwManifest.choices ?? {}).flatMap((ch) =>
      ch.options.flatMap((o) => o.consequences.filter((c) => c.type === 'modifyCounter' && c.counter.startsWith('renown:')))
    );
    expect(bare).toEqual([]);
  });

  it('a runestone read now counts toward the renown the HUD shows', () => {
    const engine = buildEngine();
    engine.handlePlayerAction(new ExecuteChoiceAction(engine.player, cotwManifest.choices!.skaldic_runestone_1, 'study_frost'));
    expect(getRenownTotal(engine, 'exploration')).toBe(10);
    expect(getRenownTotal(engine)).toBe(10);
  });

  it('content code awards its own definitions through awardMilestone, once unless repeatable', () => {
    const engine = buildEngine();
    const def = { id: 'test_deed', category: 'combat', label: 'Test Deed', renownValue: 20 };
    expect(awardMilestone(engine, def).awarded).toBe(true);
    expect(awardMilestone(engine, def).awarded).toBe(false);
    expect(hasEarnedMilestone(engine, 'test_deed')).toBe(true);
    expect(getRenownTotal(engine)).toBe(20);
  });

  // Tracker 5.6 (N27): any discovery earns renown, however it was made.
  it('a secret door noticed in passing earns Keen Eye, as a searched-out one does', () => {
    const engine = buildEngine();
    const p = engine.player;
    p.intelligence = 14;
    p.dexterity = 14;
    engine.map.setTile(6, 2, TILES.SECRET_DOOR);
    const before = getRenownTotal(engine);

    engine.handlePlayerAction(new MovementAction(p, 1, 0));

    expect(engine.map.getTile(6, 2)?.type).toBe('door_closed');
    // Keen Eye is repeatable: it adds renown each time rather than marking itself earned.
    expect(getRenownTotal(engine)).toBe(before + 5);
  });

  it('a hidden trap found, by search or in passing, earns renown', () => {
    for (const how of ['search', 'passing'] as const) {
      const engine = buildEngine();
      const p = engine.player;
      p.intelligence = 18;
      p.dexterity = 18;
      engine.map.addTrap(new TrapInstance({ id: 't', type: 'pit', x: 6, y: 3, concealment: 4 }));
      const before = getRenownTotal(engine);

      if (how === 'search') engine.handlePlayerAction(new SearchAction(p, () => 0.99));
      else engine.handlePlayerAction(new MovementAction(p, 1, 0));

      expect(engine.map.getTrapAt(6, 3)?.revealed, how).toBe(true);
      expect(getRenownTotal(engine), how).toBe(before + 2);
    }
  });

  it('the Look card shows a secret door as the wall it seems to be', () => {
    const engine = buildEngine();
    engine.map.setTile(6, 2, TILES.SECRET_DOOR);

    const terrain = TileInspector.inspectTile(engine, 6, 2).terrain!;

    expect(terrain.name).toBe(TILES.WALL.name);
    expect(terrain.type).toBe('wall');
    expect(terrain.description).toBe(TILES.WALL.description);
  });
});
