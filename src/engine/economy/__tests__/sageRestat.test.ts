import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { ItemFactory } from '../../items/factory';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import { SageService } from '../services';
import { cotwManifest } from '../../../content/cotw';
import { COTW_GRIMOIRES } from '../../../content/cotw/grimoires';

/** Plan step 2b-2: Mimir chooses one grimoire's stats afresh, for 300 + 30 CP per deepest floor. */
describe("the sage's grimoire restat", () => {
  let engine: GameEngine;
  let player: Player;

  beforeEach(() => {
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      spellsKnown: ['magic_arrow', 'firebolt'],
      grimoireSystem: COTW_GRIMOIRES,
    });
    engine = new GameEngine({ map: GameMap.createBoxRoom(12, 12), player, manifest: cotwManifest, floor: 0 });
    player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
    player.assignGrimoireStat('mani', 'x', 'power');
  });

  it('prices by the deepest floor reached, floor 1 before any', () => {
    expect(SageService.restatOffered(engine)).toBe(true);
    expect(SageService.restatPrice(engine)).toBe(330);
    engine.gameState.deepestFloor = 10;
    expect(SageService.restatPrice(engine)).toBe(600);
    engine.gameState.deepestFloor = 40;
    expect(SageService.restatPrice(engine)).toBe(1500);
  });

  it('re-picks the stats and charges the price through the command bus', () => {
    addCurrencyToPlayer(player, 1000);
    const before = getPlayerTotalCp(player);
    const res = engine.commandBus.dispatch({ type: 'sage_restat', payload: { grimoireId: 'mani', x: 'swift' } });
    expect(res.success).toBe(true);
    expect(res.message).toContain('Sage Mimir');
    expect(player.grimoireState!.statPicks).toEqual([{ grimoireId: 'mani', axis: 'x', statId: 'swift' }]);
    expect(before - getPlayerTotalCp(player)).toBe(330);
  });

  it('charges nothing for a choice that changes nothing, a refused one, or without the coin', () => {
    addCurrencyToPlayer(player, 100);
    const before = getPlayerTotalCp(player);
    expect(SageService.restatGrimoire(engine, { grimoireId: 'mani', stats: { x: 'power' } }).message).toContain('keeps the stats');
    expect(SageService.restatGrimoire(engine, { grimoireId: 'mani', stats: {} }).success).toBe(false);
    const poor = SageService.restatGrimoire(engine, { grimoireId: 'mani', stats: { x: 'swift' } });
    expect(poor.success).toBe(false);
    expect(poor.message).toContain('costs');
    expect(getPlayerTotalCp(player)).toBe(before);
    expect(player.grimoireState!.statPicks).toEqual([{ grimoireId: 'mani', axis: 'x', statId: 'power' }]);
  });

  it('is not offered where the pack prices no restat', () => {
    (engine as { manifest: GameEngine['manifest'] }).manifest = {
      ...cotwManifest,
      town: { ...cotwManifest.town!, services: { ...cotwManifest.town!.services, grimoireRestat: undefined } },
    };
    expect(SageService.restatOffered(engine)).toBe(false);
    expect(SageService.restatGrimoire(engine, { grimoireId: 'mani', stats: { x: 'swift' } }).success).toBe(false);
  });
});
