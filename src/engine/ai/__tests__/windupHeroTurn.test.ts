import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { MonsterAI } from '../behaviorTree';
import { WaitAction } from '../../actions/wait';
import { WindUpDeclareAction, WindUpExecuteAction } from '../../actions/combat';
import { serializeGame } from '../../storage/serializer';
import { deserializeSaveData } from '../../__fixtures__/testHelpers';

// A telegraphed blast always leaves the hero a turn between the warning and the strike,
// however fast the monster (sprint B6).

const DANGER = [
  { x: 5, y: 5 },
  { x: 4, y: 5 },
  { x: 5, y: 4 },
];

function setup(speed: number): { engine: GameEngine; player: Player; brute: Monster } {
  const map = new GameMap(15, 15, TILES.FLOOR);
  const player = new Player({
    position: { x: 5, y: 5 },
    stats: { hp: 1_000_000, maxHp: 1_000_000, attack: 1, defense: 0 },
    speed: 100,
  });
  const brute = new Monster({
    id: 'brute-1',
    name: 'Brute',
    position: { x: 6, y: 5 },
    stats: { hp: 1_000_000, maxHp: 1_000_000, attack: 5, defense: 0 },
    speed,
    aiType: 'brute',
    aiState: 'hunting',
  });
  const engine = new GameEngine({ map, player });
  engine.addEntity(brute);
  return { engine, player, brute };
}

const isWarning = (m: string) => m.includes('winding up') || m.includes('prepares a Battering Charge');
const isStrike = (m: string) => m.includes(' slams ') || m.includes('strikes the empty ground');

function declare(engine: GameEngine, brute: Monster, turnsRemaining = 1): void {
  new WindUpDeclareAction(brute, { x: 5, y: 5 }, 'Seismic Ground Slam', 'Brute is winding up a Seismic Ground Slam!', {
    targetTiles: DANGER,
    pattern: 'cross',
    turnsRemaining,
  }).perform(engine);
}

describe('wind-up warning leaves the hero a turn', () => {
  it('a fast monster waits, keeping its danger tiles, until the hero has had a turn', () => {
    const { engine, brute } = setup(125);
    declare(engine, brute);

    const early = MonsterAI.decideAction(brute, engine);
    expect(early).toBeInstanceOf(WaitAction);
    expect(brute.intent.type).toBe('windup');
    expect(brute.intent.targetTiles).toEqual(DANGER);

    engine.turnCount += 1;
    expect(MonsterAI.decideAction(brute, engine)).toBeInstanceOf(WindUpExecuteAction);
  });

  it('over 400 hero turns, no hero action sees a warning and then its strike', () => {
    const { engine, player } = setup(125);
    let undodgeable = 0;
    let warnings = 0;
    let strikes = 0;

    for (let i = 0; i < 400; i++) {
      engine.messages.length = 0;
      engine.handlePlayerAction(new WaitAction(player));
      const warnAt = engine.messages.findIndex(isWarning);
      if (warnAt >= 0 && engine.messages.slice(warnAt + 1).some(isStrike)) undodgeable += 1;
      warnings += engine.messages.filter(isWarning).length;
      strikes += engine.messages.filter(isStrike).length;
    }

    expect(player.isAlive()).toBe(true);
    expect(warnings).toBeGreaterThan(0);
    expect(strikes).toBeGreaterThan(0);
    expect(undodgeable).toBe(0);
  });

  it('a monster at the hero’s speed still strikes on its first action after the hero’s next turn', () => {
    const { engine, player } = setup(100);
    const log: string[][] = [];
    for (let i = 0; i < 200; i++) {
      engine.messages.length = 0;
      engine.handlePlayerAction(new WaitAction(player));
      log.push([...engine.messages]);
    }

    let checked = 0;
    for (let i = 0; i + 1 < log.length; i++) {
      if (!log[i].some(isWarning)) continue;
      expect(log[i].some(isStrike)).toBe(false);
      expect(log[i + 1].some(isStrike)).toBe(true);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('a longer warning (Wyrm-Bane) needs both its monster turns and a hero turn', () => {
    const { engine, brute } = setup(125);
    declare(engine, brute, 2);
    expect(brute.intent.turnsRemaining).toBe(2);

    expect(MonsterAI.decideAction(brute, engine)).toBeInstanceOf(WaitAction);
    expect(MonsterAI.decideAction(brute, engine)).toBeInstanceOf(WaitAction);
    expect(brute.intent.type).toBe('windup');

    engine.turnCount += 1;
    expect(MonsterAI.decideAction(brute, engine)).toBeInstanceOf(WindUpExecuteAction);

    // With the hero's turn spent early, the two monster turns still both count.
    const second = setup(125);
    declare(second.engine, second.brute, 2);
    second.engine.turnCount += 1;
    expect(MonsterAI.decideAction(second.brute, second.engine)).toBeInstanceOf(WaitAction);
    expect(MonsterAI.decideAction(second.brute, second.engine)).toBeInstanceOf(WindUpExecuteAction);
  });

  it('a wind-up saved on its declaring turn still waits for the hero after loading', () => {
    const { engine, brute } = setup(125);
    declare(engine, brute);

    const loaded = deserializeSaveData(serializeGame(engine));
    const loadedBrute = loaded.map.getEntityById('brute-1') as Monster;
    expect(loadedBrute.intent.type).toBe('windup');

    expect(MonsterAI.decideAction(loadedBrute, loaded)).toBeInstanceOf(WaitAction);
    expect(loadedBrute.intent.targetTiles).toEqual(DANGER);
    loaded.turnCount += 1;
    expect(MonsterAI.decideAction(loadedBrute, loaded)).toBeInstanceOf(WindUpExecuteAction);
  });

  it('an intent saved before the field existed strikes as it did', () => {
    const { engine, brute } = setup(125);
    declare(engine, brute);
    delete brute.intent.declaredOnTurn;

    expect(MonsterAI.decideAction(brute, engine)).toBeInstanceOf(WindUpExecuteAction);
  });
});
