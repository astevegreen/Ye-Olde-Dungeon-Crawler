import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Companion } from '../../entities/companion';
import { EngineCommandBus } from '../commandBus';
import { WaitAction } from '../../actions/wait';
import { addCurrencyToPlayer } from '../../economy/currency';
import { ItemFactory } from '../../items/factory';
import { TEST_COMPANION_ID as TEST_DEF_ID, useTestCompanion } from '../../__fixtures__/testHelpers';

function buildEngine(manifest?: object): GameEngine {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 10, y: 10 } });
  return new GameEngine({ map, player, manifest: manifest as never });
}

/** A pack whose trainer teaches one skill, declared with what it does. */
const SKILL_PACK = {
  id: 'skill_pack',
  name: 'Skill Pack',
  town: {
    services: {
      trainerSkills: [
        {
          id: 'test_howl',
          name: 'Test Howl',
          description: 'Heals the companion and hastens the hero.',
          effect: { companionHealPercent: 0.5, heroStatus: { type: 'haste', duration: 3 }, message: '{companion} howls (+{healed} HP).' },
        },
      ],
    },
  },
};

describe('Companion commands via EngineCommandBus (docs/architecture/content-companions.md Phase 2)', () => {
  useTestCompanion();

  describe('summon_companion / trainer_revive_companion / trainer_teach_skill', () => {
    it('refuses a summon before the story grants a companion, without sending the hero to a trainer', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);

      const result = bus.dispatch({ type: 'summon_companion', payload: { companionId: TEST_DEF_ID } });

      expect(result.success).toBe(false);
      expect(engine.companion).toBeNull();
      expect(engine.messages.at(-1)).toBe('You have no companion yet.');
    });

    it('once granted, allows summon, skill teaching and revival end-to-end', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      addCurrencyToPlayer(engine.player, { copper: 0, silver: 0, gold: 500 });
      engine.setWorldFlag(GameEngine.COMPANION_BONDED_FLAG, true); // as the `grantCompanion` story effect does

      const companion = engine.summonCompanion(TEST_DEF_ID)!;
      expect(companion).not.toBeNull();

      const teachResult = bus.dispatch({
        type: 'trainer_teach_skill',
        payload: { skillId: 'rally_howl', skillName: 'Rally Howl' },
      });
      expect(teachResult.success).toBe(true);
      expect(companion.unlockedSkills).toContain('rally_howl');

      companion.hp = 0;
      engine.companion = null;
      engine.deadCompanionRecord = companion;

      const reviveResult = bus.dispatch({ type: 'trainer_revive_companion' });
      expect(reviveResult.success).toBe(true);
      expect(engine.companion).toBe(companion);
      expect(companion.hp).toBe(companion.maxHp);
    });
  });

  describe('use_companion_skill', () => {
    it('refuses when the companion has not learned the skill', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);

      const result = bus.dispatch({ type: 'use_companion_skill', payload: { skillId: 'rally_howl' } });

      expect(result.success).toBe(false);
    });

    it('does what the pack declares for a learned skill: heals the companion and hastes the hero', () => {
      const engine = buildEngine(SKILL_PACK);
      const bus = new EngineCommandBus(engine);
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp-2', { x: 11, y: 10 })!;
      companion.unlockSkill('test_howl');
      companion.hp = 1;
      engine.attachCompanion(companion);

      const result = bus.dispatch({ type: 'use_companion_skill', payload: { skillId: 'test_howl' } });

      expect(result.success).toBe(true);
      expect(companion.hp).toBe(11);
      expect(engine.player.statusManager.hasStatus('haste')).toBe(true);
      expect(result.message).toBe('Test Companion howls (+10 HP).');
    });

    // At full health the companion regains nothing, and the line read "(+0 HP)".
    it('logs the no-heal line when the skill heals nothing, and the heal line when it heals', () => {
      const effect = { ...SKILL_PACK.town.services.trainerSkills[0].effect, messageNoHeal: '{companion} howls.' };
      const pack = { ...SKILL_PACK, town: { services: { trainerSkills: [{ ...SKILL_PACK.town.services.trainerSkills[0], effect }] } } };
      const howlWith = (hp: number | null) => {
        const engine = buildEngine(pack);
        const companion = Companion.fromDefinition(TEST_DEF_ID, `skill-comp-noheal-${hp}`, { x: 11, y: 10 })!;
        companion.unlockSkill('test_howl');
        if (hp !== null) companion.hp = hp;
        engine.attachCompanion(companion);
        const turn = engine.turnCount;
        const result = new EngineCommandBus(engine).dispatch({ type: 'use_companion_skill', payload: { skillId: 'test_howl' } });
        return { result, engine, turn };
      };

      const full = howlWith(null);
      expect(full.result).toMatchObject({ success: true, message: 'Test Companion howls.' });
      expect(full.engine.messages).toContain('Test Companion howls.');
      expect(full.engine.player.statusManager.hasStatus('haste')).toBe(true);
      expect(full.engine.turnCount).toBe(full.turn + 1);

      const hurt = howlWith(1);
      expect(hurt.result).toMatchObject({ success: true, message: 'Test Companion howls (+10 HP).' });
      expect(hurt.engine.player.statusManager.hasStatus('haste')).toBe(true);
      expect(hurt.engine.turnCount).toBe(hurt.turn + 1);
    });

    it('logs its one message whether or not it heals, when the pack gives no no-heal line', () => {
      for (const hp of [null, 1]) {
        const engine = buildEngine(SKILL_PACK);
        const companion = Companion.fromDefinition(TEST_DEF_ID, `skill-comp-onemsg-${hp}`, { x: 11, y: 10 })!;
        companion.unlockSkill('test_howl');
        if (hp !== null) companion.hp = hp;
        engine.attachCompanion(companion);

        const result = new EngineCommandBus(engine).dispatch({ type: 'use_companion_skill', payload: { skillId: 'test_howl' } });

        expect(result).toMatchObject({ success: true, message: `Test Companion howls (+${hp === null ? 0 : 10} HP).` });
        expect(engine.player.statusManager.hasStatus('haste')).toBe(true);
      }
    });

    it('refuses a learned skill the pack does not declare', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp-3', { x: 11, y: 10 })!;
      companion.unlockSkill('test_howl');
      engine.attachCompanion(companion);

      expect(bus.dispatch({ type: 'use_companion_skill', payload: { skillId: 'test_howl' } }).success).toBe(false);
    });

    // Rally Howl cost nothing and had no wait, so a few presses healed the companion to full
    // for free: it is an order now, spending the hero's turn, and waits out its cooldown.
    it("spends the hero's turn, then is refused at no cost until its cooldown has passed", () => {
      const pack = { ...SKILL_PACK, town: { services: { trainerSkills: [{ ...SKILL_PACK.town.services.trainerSkills[0], cooldown: 50 }] } } };
      const engine = buildEngine(pack);
      const bus = new EngineCommandBus(engine);
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'skill-comp-4', { x: 11, y: 10 })!;
      companion.unlockSkill('test_howl');
      companion.hp = 1;
      engine.attachCompanion(companion);
      const howl = () => bus.dispatch({ type: 'use_companion_skill', payload: { skillId: 'test_howl' } });

      const turn = engine.turnCount;
      expect(howl().success).toBe(true);
      expect(engine.turnCount).toBe(turn + 1);

      const hp = companion.hp;
      const refused = howl();
      expect(refused).toEqual({ success: false, message: 'Test Howl is ready in 49 turns.' });
      expect(engine.turnCount).toBe(turn + 1);
      expect(companion.hp).toBe(hp);

      while (engine.turnCount < turn + 49) engine.handlePlayerAction(new WaitAction(engine.player));
      expect(howl().message).toBe('Test Howl is ready in 1 turn.');
      engine.handlePlayerAction(new WaitAction(engine.player));
      expect(howl().success).toBe(true);
    });
  });

  describe('transfer_to_companion / transfer_from_companion', () => {
    it('moves an item from the player backpack into the companion pack and back', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      const companion = Companion.fromDefinition(TEST_DEF_ID, 'pack-comp', { x: 11, y: 10 })!;
      engine.attachCompanion(companion);

      const dagger = ItemFactory.createDagger('give-dagger-1');
      engine.player.inventory.primaryPack.addItem(dagger);

      const toResult = bus.dispatch({ type: 'transfer_to_companion', payload: { itemId: dagger.id } });
      expect(toResult.success).toBe(true);
      expect(companion.inventory.primaryPack.getItem(dagger.id)).toBeDefined();
      expect(engine.player.inventory.primaryPack.getItem(dagger.id)).toBeNull();

      const fromResult = bus.dispatch({
        type: 'transfer_from_companion',
        payload: { item: dagger },
      });
      expect(fromResult.success).toBe(true);
      expect(engine.player.inventory.primaryPack.getItem(dagger.id)).toBeDefined();
      expect(companion.inventory.primaryPack.getItem(dagger.id)).toBeNull();
    });

    it('refuses to transfer when there is no active companion', () => {
      const engine = buildEngine();
      const bus = new EngineCommandBus(engine);
      const dagger = ItemFactory.createDagger('give-dagger-2');
      engine.player.inventory.primaryPack.addItem(dagger);

      const result = bus.dispatch({ type: 'transfer_to_companion', payload: { itemId: dagger.id } });

      expect(result.success).toBe(false);
    });
  });
});
