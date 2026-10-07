import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { SpellPipeline } from '../spellPipeline';
import type { StatusHandler } from '../../status/statusHandlers';

// A spell's status logged "X is afflicted with Y!" even when the status's own handler had
// already said it took hold (cotw's burning: "X is wreathed in holy fire!"), so the log
// carried both lines. The generic line now stands in only for a handler that says nothing.
describe('the line a spell logs when its status takes hold', () => {
  const scorched: StatusHandler = { onApply: (entity) => `${entity.name} is wreathed in holy fire!` };
  const dazed: StatusHandler = { onExpire: () => undefined };

  function setup() {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    const foe = new Monster({ id: 'foe', name: 'Draugr', position: { x: 3, y: 2 }, stats: { hp: 30, maxHp: 30, attack: 1, defense: 0 } });
    map.addEntity(foe);
    const engine = new GameEngine({
      map,
      player,
      manifest: { id: 'test', name: 'Test', monsters: [], items: [], spells: [], statusHandlers: { scorched, dazed } } as never,
    });
    return { engine, player, foe };
  }

  it("logs only the handler's own line when it has one", () => {
    const { engine, player, foe } = setup();
    const before = engine.messages.length;
    SpellPipeline.applyStatusEffect(engine, player, foe, { type: 'applyStatus', statusId: 'scorched', duration: 3 });
    expect(engine.messages.slice(before)).toEqual(['Draugr is wreathed in holy fire!']);
  });

  it('logs the generic line when the handler says nothing', () => {
    const { engine, player, foe } = setup();
    const before = engine.messages.length;
    SpellPipeline.applyStatusEffect(engine, player, foe, { type: 'applyStatus', statusId: 'dazed', duration: 3 });
    expect(engine.messages.slice(before)).toEqual(['Draugr is afflicted with dazed!']);
  });
});
