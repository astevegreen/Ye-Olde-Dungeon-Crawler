import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { AiBehaviorRegistry, type AiBehaviorStrategy } from '../aiBehaviorRegistry';
import { MonsterAI } from '../behaviorTree';
import { Monster } from '../../entities/monster';
import { Player } from '../../entities/player';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { GameEngine } from '../../engine';
import { WaitAction } from '../../actions/wait';
import { MovementAction } from '../../actions/movement';
import { MeleeAttackAction, WindUpDeclareAction } from '../../actions/combat';
import { fixtureManifest, FIXTURE_AI_BEHAVIORS } from '../../../../tests/fixtures/fixture-pack';
import type { GameContentManifest } from '../../types/manifest';
import { activateRegistries } from '../../registries';

describe('AI Strategy Registry & Manifest Integration (Phase 4)', () => {
  beforeEach(() => {
    AiBehaviorRegistry.resetToDefaults();
  });

  afterAll(() => {
    activateRegistries(null);
    AiBehaviorRegistry.resetToDefaults();
  });

  function createTestEngine(manifest?: Partial<GameContentManifest>) {
    const map = new GameMap(12, 12, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 4 },
    });
    const engine = new GameEngine({
      map,
      player,
      manifest: manifest as any,
    });
    return { engine, player, map };
  }

  describe('Core AiBehaviorRegistry Unit Tests', () => {
    it('initializes with built-in strategies (melee, caster, brute, coward)', () => {
      expect(AiBehaviorRegistry.has('melee')).toBe(true);
      expect(AiBehaviorRegistry.has('caster')).toBe(true);
      expect(AiBehaviorRegistry.has('brute')).toBe(true);
      expect(AiBehaviorRegistry.has('coward')).toBe(true);

      const defaultStrategy = AiBehaviorRegistry.getDefault();
      expect(defaultStrategy).toBeDefined();
      expect(defaultStrategy.id).toBe('melee');
    });

    it('allows registering and retrieving custom AI strategies', () => {
      let decideCalled = false;
      const customStrategy: AiBehaviorStrategy = {
        id: 'patrol',
        name: 'Patrol Sentry',
        decideAction: (monster) => {
          decideCalled = true;
          return new WaitAction(monster);
        },
      };

      AiBehaviorRegistry.register(customStrategy);
      expect(AiBehaviorRegistry.has('patrol')).toBe(true);
      expect(AiBehaviorRegistry.get('patrol')).toBe(customStrategy);

      const { engine } = createTestEngine();
      const monster = new Monster({
        id: 'guard-1',
        name: 'Town Guard',
        position: { x: 2, y: 2 },
        stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 },
        aiType: 'patrol',
        aiState: 'combat',
      });
      engine.addEntity(monster);

      const action = MonsterAI.decideAction(monster, engine);
      expect(decideCalled).toBe(true);
      expect(action).toBeInstanceOf(WaitAction);
    });

    it('falls back to default strategy for unknown aiType', () => {
      const { engine } = createTestEngine();
      const monster = new Monster({
        id: 'strange-1',
        name: 'Strange Beast',
        position: { x: 5, y: 4 }, // adjacent to player at (5, 5)
        stats: { hp: 20, maxHp: 20, attack: 5, defense: 2 },
        aiType: 'non_existent_ai',
        aiState: 'combat',
      });
      engine.addEntity(monster);

      // Default strategy is 'melee', so it should perform MeleeAttackAction when adjacent
      const action = MonsterAI.decideAction(monster, engine);
      expect(action).toBeInstanceOf(MeleeAttackAction);
    });

    it('supports registerAll with records, maps, or arrays', () => {
      const stratA: AiBehaviorStrategy = {
        id: 'strat-a',
        name: 'Strategy A',
        decideAction: (m) => new WaitAction(m),
      };
      const stratB: AiBehaviorStrategy = {
        id: 'strat-b',
        name: 'Strategy B',
        decideAction: (m) => new WaitAction(m),
      };

      AiBehaviorRegistry.registerAll({ 'strat-a': stratA, 'strat-b': stratB });
      expect(AiBehaviorRegistry.has('strat-a')).toBe(true);
      expect(AiBehaviorRegistry.has('strat-b')).toBe(true);

      AiBehaviorRegistry.registerAll([
        { id: 'strat-c', name: 'Strategy C', decideAction: (m) => new WaitAction(m) },
      ]);
      expect(AiBehaviorRegistry.has('strat-c')).toBe(true);
    });

    it('supports clear and resetToDefaults', () => {
      expect(AiBehaviorRegistry.has('melee')).toBe(true);
      AiBehaviorRegistry.clear();
      expect(AiBehaviorRegistry.has('melee')).toBe(false);

      AiBehaviorRegistry.resetToDefaults();
      expect(AiBehaviorRegistry.has('melee')).toBe(true);
      expect(AiBehaviorRegistry.has('caster')).toBe(true);
    });
  });

  describe('GameEngine & Manifest AI Integration', () => {
    it('automatically registers manifest.aiBehaviors during engine construction', () => {
      let customRan = false;
      const customAi: AiBehaviorStrategy = {
        id: 'custom_manifest_ai',
        name: 'Custom Manifest AI',
        decideAction: (monster) => {
          customRan = true;
          return new WaitAction(monster);
        },
      };

      const { engine } = createTestEngine({
        id: 'test-manifest',
        name: 'Test Manifest',
        aiBehaviors: { custom_manifest_ai: customAi },
      });

      expect(AiBehaviorRegistry.has('custom_manifest_ai')).toBe(true);

      const monster = new Monster({
        id: 'm1',
        name: 'Custom Mob',
        position: { x: 3, y: 3 },
        stats: { hp: 10, maxHp: 10, attack: 2, defense: 1 },
        aiType: 'custom_manifest_ai',
        aiState: 'combat',
      });
      engine.addEntity(monster);

      MonsterAI.decideAction(monster, engine);
      expect(customRan).toBe(true);
    });

    it('integrates the fixture WarlordBehavior in fixtureManifest', () => {
      expect(fixtureManifest.aiBehaviors).toBeDefined();
      expect(fixtureManifest.aiBehaviors?.warlord).toBeDefined();
      expect(FIXTURE_AI_BEHAVIORS.warlord).toBeDefined();

      const { engine } = createTestEngine(fixtureManifest);
      expect(AiBehaviorRegistry.has('warlord')).toBe(true);

      // Create Warlord adjacent to player
      const warlord = new Monster({
        id: 'boss-warlord',
        name: 'Warlord',
        position: { x: 5, y: 4 }, // distance 1 from player (5, 5)
        stats: { hp: 120, maxHp: 120, attack: 18, defense: 7 },
        aiType: 'warlord',
        aiState: 'combat',
        fleeHealthPercent: 0,
      });
      engine.addEntity(warlord);

      // Action should be either MeleeAttackAction or WindUpDeclareAction ('Crushing Blow')
      const action = MonsterAI.decideAction(warlord, engine);
      expect(
        action instanceof MeleeAttackAction || action instanceof WindUpDeclareAction
      ).toBe(true);

      // Low health triggers combat roar
      warlord.hp = 30; // < 40% of 120 (48)
      MonsterAI.decideAction(warlord, engine);
      expect(engine.messages.some(m => m.includes("No retreat!"))).toBe(true);
    });

    it('WarlordBehavior navigates towards player when at distance', () => {
      const { engine } = createTestEngine(fixtureManifest);
      const warlord = new Monster({
        id: 'boss-warlord-far',
        name: 'Warlord',
        position: { x: 5, y: 2 }, // distance 3 from player at (5, 5)
        stats: { hp: 120, maxHp: 120, attack: 18, defense: 7 },
        aiType: 'warlord',
        aiState: 'combat',
        fleeHealthPercent: 0,
      });
      engine.addEntity(warlord);

      const action = MonsterAI.decideAction(warlord, engine);
      expect(action).toBeInstanceOf(MovementAction);
      const move = action as MovementAction;
      // Moving down towards player at y=5
      expect(move.dy).toBeGreaterThan(0);
    });
  });
});
