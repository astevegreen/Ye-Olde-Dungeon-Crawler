import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { WaitAction } from '../actions/wait';
import { MovementAction } from '../actions/movement';
import { isGameEvent, type GameEvent } from '../events';

/**
 * Domain events (ARCHITECTURE.md §4): scalar payloads, an open envelope content can
 * extend, and delivery on ActionResult as well as the onGameEvent callback.
 */
function buildEngine() {
  const map = new GameMap(14, 14, TILES.FLOOR);
  const player = new Player({
    id: 'hero',
    name: 'Hero',
    position: { x: 3, y: 3 },
    stats: { hp: 200, maxHp: 200, attack: 500, defense: 5 },
  });
  return { engine: new GameEngine({ map, player, seed: 5 }), player };
}

describe('Domain events', () => {
  it('carries scalar IDs, never live object references', () => {
    const { engine, player } = buildEngine();
    const monster = new Monster({
      id: 'victim-1',
      name: 'Rat',
      position: { x: 4, y: 3 },
      stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 },
      speed: 100,
      definitionId: 'rat',
      aiType: 'melee',
      aiState: 'hunting',
      fleeHealthPercent: 0,
      xpValue: 1,
      lootTable: [],
    });
    engine.addEntity(monster);

    engine.handlePlayerAction(new MovementAction(player, 1, 0));

    const killed = engine.recentGameEvents.find((e) => e.type === 'entity_killed');
    expect(killed).toBeDefined();
    expect(killed!.targetId).toBe('victim-1');
    expect(killed!.actorId).toBe(player.id);
    expect(typeof killed!.turn).toBe('number');
    // No live references anywhere in the payload: the whole event survives JSON.
    expect(() => JSON.stringify(killed)).not.toThrow();
    expect(JSON.parse(JSON.stringify(killed))).toEqual(killed);
  });

  it('returns the events an action emitted on its ActionResult', () => {
    const { engine, player } = buildEngine();
    const monster = new Monster({
      id: 'victim-2',
      name: 'Rat',
      position: { x: 4, y: 3 },
      stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 },
      speed: 100,
      definitionId: 'rat',
      aiType: 'melee',
      aiState: 'hunting',
      fleeHealthPercent: 0,
      xpValue: 1,
      lootTable: [],
    });
    engine.addEntity(monster);

    const result = engine.handlePlayerAction(new MovementAction(player, 1, 0));

    expect(result.events?.some((e) => e.type === 'entity_killed')).toBe(true);
  });

  it('omits the events field when an action emits nothing', () => {
    const { engine, player } = buildEngine();

    const result = engine.handlePlayerAction(new WaitAction(player));

    expect(result.events).toBeUndefined();
  });

  it('accepts content-defined event types without engine changes', () => {
    const { engine } = buildEngine();
    const seen: GameEvent[] = [];
    engine.onGameEvent = (e) => seen.push(e);

    engine.emitGameEvent({
      type: 'cotw:relic_attuned',
      turn: engine.turnCount,
      actorId: 'hero',
      itemId: 'relic-1',
      data: { resonance: 3 },
    });

    expect(seen.map((e) => e.type)).toContain('cotw:relic_attuned');
    expect(isGameEvent(seen[0], 'entity_killed')).toBe(false);
  });

  it('narrows built-in events through isGameEvent', () => {
    const { engine } = buildEngine();
    engine.emitGameEvent({
      type: 'level_transition',
      turn: engine.turnCount,
      fromFloor: 1,
      toFloor: 2,
    });

    const event = engine.recentGameEvents[engine.recentGameEvents.length - 1];
    expect(isGameEvent(event, 'level_transition')).toBe(true);
    if (isGameEvent(event, 'level_transition')) {
      expect(event.toFloor).toBe(2);
    }
  });
});
