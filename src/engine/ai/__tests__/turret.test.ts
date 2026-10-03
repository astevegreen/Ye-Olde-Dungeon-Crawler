import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { MonsterAI } from '../behaviorTree';
import { MovementAction } from '../../actions/movement';
import { WindUpDeclareAction } from '../../actions/combat';
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
