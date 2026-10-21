import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MonsterAI } from '../behaviorTree';
import { MovementAction } from '../../actions/movement';
import { MeleeAttackAction, WindUpDeclareAction } from '../../actions/combat';
import { cotwManifest } from '../../../content/cotw';
import { createScaledMonster } from '../../dungeon/spawner';

describe('immobile turrets', () => {
  it('a wounded turret holds its ground instead of fleeing', () => {
    const map = new GameMap(12, 7, TILES.FLOOR);
    const player = new Player({ id: 'hero', position: { x: 2, y: 3 }, stats: { hp: 80, maxHp: 80, attack: 1, defense: 0 } });
    const engine = new GameEngine({ map, player });
    const turret = new Monster({
      id: 'turret',
      name: 'Turret',
      position: { x: 5, y: 3 },
      stats: { hp: 3, maxHp: 40, attack: 4, defense: 0 },
      aiType: 'immobile_turret',
      aiState: 'hunting',
      fleeHealthPercent: 0.2,
      xpValue: 1,
      lootTable: [],
    });
    engine.addEntity(turret);

    for (let t = 0; t < 5; t++) {
      expect(MonsterAI.decideAction(turret, engine)).not.toBeInstanceOf(MovementAction);
    }
  });

  it('a turret with a telegraphed ability winds it up', () => {
    const map = new GameMap(12, 7, TILES.FLOOR);
    const def = cotwManifest.monsters.find((m) => m.aiType === 'immobile_turret' && m.telegraphedAbility)!;
    const testEngine = new GameEngine({
      map,
      player: new Player({ id: 'hero', position: { x: 2, y: 3 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 0 } }),
      manifest: cotwManifest,
      seed: 4,
    });
    const turret = createScaledMonster(def, 'captive', { x: 5, y: 3 }, def.minFloor ?? 1);
    turret.aiState = 'hunting';
    testEngine.addEntity(turret);

    let woundUp = false;
    for (let t = 0; t < 40 && !woundUp; t++) {
      turret.spellCooldown = 0;
      turret.intent = { type: 'idle', turnsRemaining: 0 };
      woundUp = MonsterAI.decideAction(turret, testEngine) instanceof WindUpDeclareAction;
    }
    expect(woundUp).toBe(true);
  });
});

describe('a turret winds up only at a hero it perceives (B5)', () => {
  const turretDef = cotwManifest.monsters.find((m) => m.aiType === 'immobile_turret' && m.telegraphedAbility)!;

  /** A 15×15 hall, the hero at (5,5), a hunting cotw turret at `at`, every chance roll passing. */
  function setup(at: { x: number; y: number }) {
    const engine = new GameEngine({
      map: new GameMap(15, 15, TILES.FLOOR),
      player: new Player({ id: 'hero', position: { x: 5, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 0 } }),
      manifest: cotwManifest,
      seed: 4,
    });
    engine.rng = () => 0;
    const turret = createScaledMonster(turretDef, 'captive', at, turretDef.minFloor ?? 1);
    turret.aiState = 'hunting';
    turret.spellCooldown = 0;
    engine.addEntity(turret);
    return { engine, turret };
  }

  it('never winds up at a hero hidden in dense steam', () => {
    for (let t = 0; t < 20; t++) {
      const { engine, turret } = setup({ x: 8, y: 5 });
      engine.surfaces.layGas(engine, 5, 5, 'dense_steam', 50);
      expect(MonsterAI.decideAction(turret, engine)).not.toBeInstanceOf(WindUpDeclareAction);
    }
  });

  it('never winds up while blinded', () => {
    for (let t = 0; t < 20; t++) {
      const { engine, turret } = setup({ x: 8, y: 5 });
      turret.statusManager.applyStatus({ type: 'blindness', duration: 10 }, [], turret, engine);
      expect(MonsterAI.decideAction(turret, engine)).not.toBeInstanceOf(WindUpDeclareAction);
    }
  });

  it('winds up at a hero it sees', () => {
    const { engine, turret } = setup({ x: 8, y: 5 });
    expect(MonsterAI.decideAction(turret, engine)).toBeInstanceOf(WindUpDeclareAction);
  });

  it('still strikes a hero beside it in dense steam', () => {
    const { engine, turret } = setup({ x: 6, y: 5 });
    engine.surfaces.layGas(engine, 5, 5, 'dense_steam', 50);
    expect(MonsterAI.decideAction(turret, engine)).toBeInstanceOf(MeleeAttackAction);
  });
});
