import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { COTW_MANIFEST } from '../../content/cotw';
import { Monster } from '../entities/monster';
import { createTestOgre, createTestKoboldShaman } from '../__fixtures__/testHelpers';
import { MovementAction } from '../actions/movement';
import { WindUpDeclareAction } from '../actions/combat';
import { serializeSaveData, deserializeSaveData } from '../storage/serializer';

describe('Telegraphed Enemy Wind-Up Attacks & Monster Intent', () => {
  let engine: GameEngine;
  let map: GameMap;
  let player: Player;

  beforeEach(() => {
    map = GameMap.createBoxRoom(20, 20);
    player = new Player({
      id: 'test_hero',
      name: 'Valiant',
      position: { x: 5, y: 5 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 2 },
      speed: 100,
    });
    engine = new GameEngine({ map, player, floor: 1, manifest: COTW_MANIFEST });
    engine.updateFov();
  });

  it('declares wind-up intent with target tile locking and 1 turn duration', () => {
    const ogre = createTestOgre('ogre-1', { x: 5, y: 6 });
    engine.addEntity(ogre);

    const declareAction = new WindUpDeclareAction(
      ogre,
      { x: 5, y: 5 },
      'Crushing Club Slam',
      'The Ogre Brute raises his massive club!'
    );

    const result = declareAction.perform(engine);
    expect(result.success).toBe(true);
    expect(ogre.intent.type).toBe('windup');
    expect(ogre.intent.targetTile).toEqual({ x: 5, y: 5 });
    expect(ogre.intent.abilityName).toBe('Crushing Club Slam');
    expect(ogre.intent.turnsRemaining).toBe(1);
    expect(engine.messages).toContain('The Ogre Brute raises his massive club!');
  });

  it('executes heavy damage on turn 2 if the player remains on the targeted tile', () => {
    const ogre = createTestOgre('ogre-2', { x: 5, y: 6 });
    ogre.intent = {
      type: 'windup',
      targetTile: { x: 5, y: 5 },
      abilityName: 'Crushing Club Slam',
      turnsRemaining: 1,
    };
    engine.addEntity(ogre);

    const initialHp = engine.player.hp;

    // Monster takes turn via takeTurn
    const turnResult = ogre.takeTurn(engine);
    expect(turnResult.success).toBe(true);
    // Player was hit by the crushing blow
    expect(engine.player.hp).toBeLessThan(initialHp);
    const damage = initialHp - engine.player.hp;
    // Ogre attack is 14, 2.5x multiplier -> ~35 raw damage minus defense
    expect(damage).toBeGreaterThanOrEqual(15);
    expect(ogre.intent.type).toBe('attack');
  });

  it('sidestepping avoids the wind-up attack damage completely', () => {
    const ogre = createTestOgre('ogre-3', { x: 5, y: 6 });
    ogre.intent = {
      type: 'windup',
      targetTile: { x: 5, y: 5 },
      abilityName: 'Crushing Club Slam',
      turnsRemaining: 1,
    };
    engine.addEntity(ogre);

    // Player steps West to (4, 5) to dodge the slam
    engine.handlePlayerAction(new MovementAction(engine.player, -1, 0));
    expect(engine.player.x).toBe(4);
    expect(engine.player.y).toBe(5);

    const initialHp = engine.player.hp;

    // Ogre executes windup on (5, 5)
    ogre.takeTurn(engine);

    // Player took 0 damage because they were at (4, 5)
    expect(engine.player.hp).toBe(initialHp);
    expect(engine.messages.some((m) => m.includes('strikes the empty ground'))).toBe(true);
  });

  it('interrupting the monster via paralysis or interruptWindUp cancels the attack', () => {
    const ogre = createTestOgre('ogre-4', { x: 5, y: 6 });
    ogre.intent = {
      type: 'windup',
      targetTile: { x: 5, y: 5 },
      abilityName: 'Crushing Club Slam',
      turnsRemaining: 1,
    };
    engine.addEntity(ogre);

    // Inflict paralysis on the ogre
    ogre.statusManager.applyStatus({ type: 'paralysis', duration: 2 });
    expect(ogre.statusManager.hasStatus('paralysis')).toBe(true);

    const initialHp = engine.player.hp;

    // Monster attempts turn while paralyzed
    const actionResult = ogre.takeTurn(engine);
    expect(actionResult.message).toContain('paralyzed and cannot act');
    expect(ogre.intent.type).toBe('idle');
    expect(engine.player.hp).toBe(initialHp);
  });

  it('tactical caster (Kobold Shaman) can wind up and execute telegraphed Incinerate at range', () => {
    const shaman = createTestKoboldShaman('shaman-1', { x: 5, y: 8 }); // distance 3 tiles
    shaman.intent = {
      type: 'windup',
      targetTile: { x: 5, y: 5 },
      abilityName: 'Incinerate',
      turnsRemaining: 1,
    };
    engine.addEntity(shaman);

    const initialHp = engine.player.hp;

    shaman.takeTurn(engine);
    expect(engine.player.hp).toBeLessThan(initialHp);
    expect(engine.messages.some((m) => m.includes('Incinerate'))).toBe(true);
  });

  it('serializes and deserializes active monster wind-up intent cleanly', () => {
    const ogre = createTestOgre('ogre-save-test', { x: 8, y: 8 });
    ogre.intent = {
      type: 'windup',
      targetTile: { x: 8, y: 7 },
      abilityName: 'Crushing Club Slam',
      turnsRemaining: 1,
    };
    engine.addEntity(ogre);

    const serialized = serializeSaveData(engine);
    const restoredEngine = deserializeSaveData(serialized, COTW_MANIFEST);

    const restoredOgre = restoredEngine.map.getEntityById('ogre-save-test') as Monster;
    expect(restoredOgre).not.toBeNull();
    expect(restoredOgre.intent).toBeDefined();
    expect(restoredOgre.intent.type).toBe('windup');
    expect(restoredOgre.intent.abilityName).toBe('Crushing Club Slam');
    expect(restoredOgre.intent.targetTile).toEqual({ x: 8, y: 7 });
    expect(restoredOgre.intent.turnsRemaining).toBe(1);
  });
});
