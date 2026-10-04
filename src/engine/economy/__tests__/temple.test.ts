import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { ItemFactory } from '../../items/factory';
import type { ItemModifier } from '../../items/modifiers';
import { addCurrencyToPlayer, getPlayerTotalCp } from '../currency';
import { TempleService } from '../services';
import { cotwManifest } from '../../../content/cotw';

/** Tracker 2.6: the temple (Q9 "A", Q34 "A", Q49 "A", Q50 "A"). */
const cursed: ItemModifier = { id: 'c', name: 'Cursed', alignment: 'negative', category: 'cursed', prefix: 'Cursed', binds: true };
const helTouched: ItemModifier = { id: 'h', name: 'Hel-touched', alignment: 'negative', category: 'unholy', prefix: 'Hel-touched', binds: true, templeShunned: true };

function heroEngine(): GameEngine {
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 10, maxHp: 40, attack: 10, defense: 5 }, strength: 15 });
  const engine = new GameEngine({ map: GameMap.createBoxRoom(12, 12), player, manifest: cotwManifest, floor: 0 });
  player.inventory.paperdoll.equip(ItemFactory.createCoinPurse('purse'), 'purse');
  return engine;
}

function wear(engine: GameEngine, modifier: ItemModifier, id = 'worn'): Item {
  const ring = new Item({ id, name: 'Iron Band', category: 'ring', slot: 'fingerLeft', weight: 50, bulk: 40, identified: true });
  ring.addModifier({ ...modifier });
  engine.player.inventory.paperdoll.equip(ring, 'fingerLeft');
  return ring;
}

describe('the temple after Tyr is desecrated (Q50 "A")', () => {
  let engine: GameEngine;
  beforeEach(() => {
    engine = heroEngine();
    engine.worldState.factions.temple_standing = -10;
  });

  it('still cleanses a bound item, at double the price', () => {
    const ring = wear(engine, cursed);
    addCurrencyToPlayer(engine.player, 1000);
    const result = TempleService.cleanseCurses(engine.player, undefined, undefined, engine);
    expect(result.success).toBe(true);
    expect(ring.isBound()).toBe(false);
    expect(1000 - getPlayerTotalCp(engine.player)).toBe(TempleService.CURSE_CLEANSE_COST_CP * 2);
  });

  it('does not double the double for a Hel-touched item', () => {
    wear(engine, helTouched);
    addCurrencyToPlayer(engine.player, 2000);
    expect(TempleService.cleanseCurses(engine.player, undefined, undefined, engine).success).toBe(true);
    expect(2000 - getPlayerTotalCp(engine.player)).toBe(TempleService.CURSE_CLEANSE_COST_CP * 2);
  });

  it('still refuses to heal', () => {
    addCurrencyToPlayer(engine.player, 1000);
    const result = TempleService.healAndRestore(engine.player, undefined, undefined, engine);
    expect(result.success).toBe(false);
    expect(getPlayerTotalCp(engine.player)).toBe(1000);
  });

  it('cleanses past the corruption refusal too: the cleanse is never refused', () => {
    engine.worldState.factions.temple_standing = 0;
    engine.player.corruptionScore = 80;
    wear(engine, cursed);
    addCurrencyToPlayer(engine.player, 1000);
    expect(TempleService.cleanseCurses(engine.player, undefined, undefined, engine).success).toBe(true);
    expect(TempleService.healAndRestore(engine.player, undefined, undefined, engine).success).toBe(false);
  });
});
