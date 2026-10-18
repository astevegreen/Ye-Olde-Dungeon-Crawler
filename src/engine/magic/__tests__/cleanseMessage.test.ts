import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { SpellPipeline } from '../spellPipeline';
import type { StatusHandler } from '../../status/statusHandlers';

// Heal beside Magic Arrow lends "Cleansing", so every arrow cast logged "Astrid has nothing
// to cleanse." (playtest, 18 Oct). A cleanse with nothing to lift now says nothing.
describe('the line a cleanse logs', () => {
  const sickness: StatusHandler = { affliction: true };

  function setup() {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 2, y: 2 } });
    const engine = new GameEngine({
      map,
      player,
      manifest: { id: 'test', name: 'Test', monsters: [], items: [], spells: [], statusHandlers: { sickness } } as never,
    });
    return { engine, player };
  }

  it('says nothing when there is nothing to lift', () => {
    const { engine, player } = setup();
    const before = engine.messages.length;
    SpellPipeline.cleanse(engine, player, false);
    expect(engine.messages.slice(before)).toEqual([]);
  });

  it('names what it lifts', () => {
    const { engine, player } = setup();
    player.statusManager.applyStatus('sickness', 5);
    const before = engine.messages.length;
    SpellPipeline.cleanse(engine, player, false);
    expect(engine.messages.slice(before)).toEqual(['Hero is cleansed of sickness.']);
    expect(player.statusManager.getAll()).toEqual([]);
  });
});
