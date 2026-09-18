import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import {
  AIRegistry,
  type AIStrategy,
  AggressiveMeleeStrategy,
  KitingRangedStrategy,
  ImmobileTurretStrategy,
  FleeingCowardStrategy,
} from '../ai/aiRegistry';
import { MonsterAI } from '../ai/behaviorTree';
import { Monster } from '../entities/monster';
import { Player } from '../entities/player';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { MeleeAttackAction } from '../actions/combat';
import { MovementAction } from '../actions/movement';
import { CastSpellAction } from '../actions/spell-actions';
import { WaitAction } from '../actions/wait';

describe('Pluggable AI Strategy Registry (AIRegistry)', () => {
  let engine: GameEngine;
  let player: Player;
  let map: GameMap;

  beforeEach(() => {
    AIRegistry.resetToDefaults();
    map = new GameMap(20, 20);
    map.fill(TILES.FLOOR);
    player = new Player({
      position: { x: 10, y: 10 },
      stats: { hp: 100, maxHp: 100, attack: 10, defense: 5 },
    });
    engine = new GameEngine({ map, player, floor: 1 });
  });

  afterAll(() => {
    AIRegistry.resetToDefaults();
  });

  describe('Default Strategies', () => {
    it('registers default AI strategies out of the box', () => {
      expect(AIRegistry.has('aggressive_melee')).toBe(true);
      expect(AIRegistry.has('kiting_ranged')).toBe(true);
      expect(AIRegistry.has('immobile_turret')).toBe(true);
      expect(AIRegistry.get('immobile_turret')).toBeInstanceOf(ImmobileTurretStrategy);
      expect(AIRegistry.has('fleeing_coward')).toBe(true);
    });

    it('resolves legacy alias IDs smoothly', () => {
      expect(AIRegistry.get('melee')).toBeInstanceOf(AggressiveMeleeStrategy);
      expect(AIRegistry.get('caster')).toBeInstanceOf(KitingRangedStrategy);
      expect(AIRegistry.get('coward')).toBeInstanceOf(FleeingCowardStrategy);
      expect(AIRegistry.get('brute')).toBeInstanceOf(AggressiveMeleeStrategy);
    });
  });

  describe('Strategy Execution Behaviors', () => {
    it('AggressiveMeleeStrategy attacks when adjacent and moves when at range', () => {
      const brawler = new Monster({
        id: 'brawler-1',
        name: 'Brawler',
        position: { x: 10, y: 9 }, // adjacent (distance 1)
        aiType: 'aggressive_melee',
        aiState: 'combat',
        stats: { hp: 30, maxHp: 30, attack: 8, defense: 2 },
      });
      engine.addEntity(brawler);

      const action = MonsterAI.decideAction(brawler, engine);
      expect(action).toBeInstanceOf(MeleeAttackAction);

      // Move away
      brawler.setPosition(10, 5);
      const moveAction = MonsterAI.decideAction(brawler, engine);
      expect(moveAction).toBeInstanceOf(MovementAction);
    });

    it('KitingRangedStrategy retreats if adjacent and casts spell when at optimal range', () => {
      const archer = new Monster({
        id: 'archer-1',
        name: 'Archer',
        position: { x: 10, y: 9 }, // adjacent
        aiType: 'kiting_ranged',
        aiState: 'combat',
        spells: ['firebolt'],
        stats: { hp: 20, maxHp: 20, attack: 4, defense: 1 },
      });
      engine.addEntity(archer);

      // When adjacent, it should attempt to flee/step back
      const kiteAction = MonsterAI.decideAction(archer, engine);
      expect(kiteAction).toBeInstanceOf(MovementAction);

      // At range 3 (10, 7) with spell ready -> casts spell
      archer.setPosition(10, 7);
      archer.spellCooldown = 0;
      const castAction = MonsterAI.decideAction(archer, engine);
      expect(castAction).toBeInstanceOf(CastSpellAction);
    });

    it('ImmobileTurretStrategy attacks/casts without moving', () => {
      const turret = new Monster({
        id: 'turret-1',
        name: 'Arcane Turret',
        position: { x: 10, y: 7 }, // distance 3
        aiType: 'immobile_turret',
        aiState: 'combat',
        spells: ['magic_missile'],
        stats: { hp: 50, maxHp: 50, attack: 5, defense: 5 },
      });
      engine.addEntity(turret);

      const action = MonsterAI.decideAction(turret, engine);
      expect(action).toBeInstanceOf(CastSpellAction);

      // When out of range (distance 15) and no spells, it waits instead of moving
      turret.setPosition(1, 1);
      const farAction = MonsterAI.decideAction(turret, engine);
      expect(farAction).toBeInstanceOf(WaitAction);
    });

    it('FleeingCowardStrategy moves away from player', () => {
      const goblin = new Monster({
        id: 'scared-goblin',
        name: 'Scared Goblin',
        position: { x: 10, y: 8 }, // distance 2
        aiType: 'fleeing_coward',
        aiState: 'combat',
        stats: { hp: 10, maxHp: 10, attack: 2, defense: 1 },
      });
      engine.addEntity(goblin);

      const action = MonsterAI.decideAction(goblin, engine);
      expect(action).toBeInstanceOf(MovementAction);
      const move = action as MovementAction;
      // Moving away from player at (10, 10): dy should be negative (north)
      expect(move.dy).toBeLessThan(0);
    });
  });

  describe('Pluggable Custom AI & aiRoutineId Priority', () => {
    it('prioritizes actor.aiRoutineId over monster.aiType', () => {
      let customExecuted = false;
      const customRoutine: AIStrategy = {
        id: 'sentry_dance',
        name: 'Sentry Dance',
        decideAction: (actor) => {
          customExecuted = true;
          return new WaitAction(actor);
        },
      };

      AIRegistry.register(customRoutine);

      const monster = new Monster({
        id: 'dancer-1',
        name: 'Dancer',
        position: { x: 10, y: 9 },
        aiType: 'aggressive_melee', // Default would attack
        aiRoutineId: 'sentry_dance', // Overridden routine
        aiState: 'combat',
        stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 },
      });
      engine.addEntity(monster);

      const action = MonsterAI.decideAction(monster, engine);
      expect(customExecuted).toBe(true);
      expect(action).toBeInstanceOf(WaitAction);
    });

    it('registers manifest-defined aiStrategies during engine setup', () => {
      let manifestAiCalled = false;
      const manifestAi: AIStrategy = {
        id: 'manifest_guard',
        name: 'Manifest Guard',
        decideAction: (actor) => {
          manifestAiCalled = true;
          return new WaitAction(actor);
        },
      };

      const manifestEngine = new GameEngine({
        map,
        player,
        manifest: {
          id: 'test-pack',
          name: 'Test Pack',
          aiStrategies: {
            manifest_guard: manifestAi,
          },
        } as any,
      });

      expect(AIRegistry.has('manifest_guard')).toBe(true);

      const guard = new Monster({
        id: 'm-guard',
        name: 'Palace Guard',
        position: { x: 8, y: 8 },
        aiRoutineId: 'manifest_guard',
        aiState: 'combat',
        stats: { hp: 25, maxHp: 25, attack: 6, defense: 3 },
      });
      manifestEngine.addEntity(guard);

      MonsterAI.decideAction(guard, manifestEngine);
      expect(manifestAiCalled).toBe(true);
    });
  });
});
