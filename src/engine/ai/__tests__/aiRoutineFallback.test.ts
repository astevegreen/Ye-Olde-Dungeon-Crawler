import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MonsterAI, resetAiFallbackWarnings } from '../behaviorTree';
import { Monster } from '../../entities/monster';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { GameEngine } from '../../engine';
import { flightRecorder } from '../../debug/flightRecorder';

// Neither registered in AIRegistry, LEGACY_ALIASES, nor AiBehaviorRegistry: forces the
// fallback-to-default path in MonsterAI.decideAction (ARCHITECTURE.md registry-contract audit).
const UNKNOWN_AI_TYPE = 'no_such_ai_routine';

describe('MonsterAI fallback-strategy visibility (ARCHITECTURE.md registry-contract audit)', () => {
  let engine: GameEngine;
  let player: Player;

  beforeEach(() => {
    resetAiFallbackWarnings();
    flightRecorder.clear();
    const map = new GameMap(12, 12, TILES.FLOOR);
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
    });
    engine = new GameEngine({ map, player });
  });

  afterEach(() => {
    resetAiFallbackWarnings();
  });

  function fallbackWarnings() {
    return flightRecorder
      .getEvents()
      .filter((e) => e.type === 'warning' && (e.details as any)?.source === 'MonsterAI.decideAction');
  }

  it('records a flight-recorder warning and still returns a usable action (does not throw)', () => {
    const monster = new Monster({
      id: 'broken-1',
      name: 'Broken Monster',
      position: { x: 6, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      speed: 100,
      definitionId: 'broken-1',
      aiType: UNKNOWN_AI_TYPE,
      xpValue: 1,
      lootTable: [],
    });

    let action: unknown;
    expect(() => {
      action = MonsterAI.decideAction(monster, engine);
    }).not.toThrow();
    expect(action).toBeDefined();

    const warnings = fallbackWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].summary).toContain(UNKNOWN_AI_TYPE);
    expect((warnings[0].details as any)?.entityId).toBe('broken-1');
  });

  it('warns only once per monster instance even across many turns (no per-turn spam)', () => {
    const monster = new Monster({
      id: 'broken-2',
      name: 'Broken Monster 2',
      position: { x: 6, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      speed: 100,
      definitionId: 'broken-2',
      aiType: UNKNOWN_AI_TYPE,
      xpValue: 1,
      lootTable: [],
    });

    for (let i = 0; i < 10; i++) {
      MonsterAI.decideAction(monster, engine);
    }

    expect(fallbackWarnings().length).toBe(1);
  });

  it('warns separately for a second, distinct monster instance hitting the same fallback', () => {
    const monsterA = new Monster({
      id: 'broken-a',
      name: 'A',
      position: { x: 6, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      speed: 100,
      definitionId: 'broken-a',
      aiType: UNKNOWN_AI_TYPE,
      xpValue: 1,
      lootTable: [],
    });
    const monsterB = new Monster({
      id: 'broken-b',
      name: 'B',
      position: { x: 7, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      speed: 100,
      definitionId: 'broken-b',
      aiType: UNKNOWN_AI_TYPE,
      xpValue: 1,
      lootTable: [],
    });

    MonsterAI.decideAction(monsterA, engine);
    MonsterAI.decideAction(monsterB, engine);

    expect(fallbackWarnings().length).toBe(2);
  });

  it('never warns for a monster with a valid, registered aiType', () => {
    const monster = new Monster({
      id: 'valid-melee',
      name: 'Valid Melee',
      position: { x: 6, y: 5 },
      stats: { hp: 10, maxHp: 10, attack: 3, defense: 1 },
      speed: 100,
      definitionId: 'valid-melee',
      aiType: 'melee',
      xpValue: 1,
      lootTable: [],
    });

    MonsterAI.decideAction(monster, engine);

    expect(fallbackWarnings().length).toBe(0);
  });
});
