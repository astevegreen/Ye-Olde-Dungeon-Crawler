import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { MeleeAttackAction } from '../actions/combat';
import { DeathResolver } from '../combat/deathResolver';
import { warcraftManifest } from '../../content/warcraft';
import type { GameContentManifest, CombatConfig, ProgressionConfig } from '../types/manifest';

describe('Feature Flags, CombatConfig, and ProgressionConfig Manifest Extensions (Phase 5)', () => {
  function createEngine(manifest?: Partial<GameContentManifest>, playerConfig?: Partial<any>) {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 4 },
      ...playerConfig,
    });
    const engine = new GameEngine({
      map,
      player,
      manifest: manifest as any,
    });
    return { engine, player, map };
  }

  describe('Feature Flags Integration', () => {
    it('accurately queries featureFlags via engine.hasFeature()', () => {
      const { engine } = createEngine({
        id: 'flags-test',
        name: 'Flags Test',
        featureFlags: {
          stealthSubsystem: true,
          ammoCombat: false,
        },
      });

      expect(engine.hasFeature('stealthSubsystem')).toBe(true);
      expect(engine.hasFeature('ammoCombat')).toBe(false);
      expect(engine.hasFeature('nonExistentFeature')).toBe(false);
    });

    it('returns false when manifest defines no featureFlags', () => {
      const { engine } = createEngine({
        id: 'no-flags',
        name: 'No Flags',
      });

      expect(engine.hasFeature('anyFlag')).toBe(false);
    });
  });

  describe('CombatConfig Integration in MeleeAttackAction', () => {
    it('enforces minDamage threshold when target defense exceeds attack', () => {
      const combatConfig: CombatConfig = {
        minDamage: 5,
      };

      const { engine, player } = createEngine({
        id: 'min-damage-test',
        name: 'Min Damage Test',
        combatConfig,
      });

      // Defender has 999 defense; normal formula would yield 1 damage
      const defender = new Monster({
        id: 'golem',
        name: 'Iron Golem',
        position: { x: 5, y: 4 },
        stats: { hp: 100, maxHp: 100, attack: 10, defense: 999 },
      });
      engine.addEntity(defender);

      const action = new MeleeAttackAction(player, defender);
      const res = engine.handlePlayerAction(action);

      expect(res.success).toBe(true);
      expect(defender.hp).toBe(95); // took exactly minDamage 5
    });

    it('triggers critical strikes when critChance is met', () => {
      const combatConfig: CombatConfig = {
        minDamage: 1,
        critChance: 1.0, // Guaranteed crit for test
        critMultiplier: 2.0,
      };

      const { engine, player } = createEngine({
        id: 'crit-test',
        name: 'Crit Test',
        combatConfig,
      });

      const defender = new Monster({
        id: 'mob',
        name: 'Target Mob',
        position: { x: 5, y: 4 },
        stats: { hp: 50, maxHp: 50, attack: 2, defense: 0 },
      });
      engine.addEntity(defender);

      // Normal rawDamage = 10 - 0 = 10. Crit multiplier 2.0 -> 20 damage!
      const action = new MeleeAttackAction(player, defender);
      engine.handlePlayerAction(action);

      expect(defender.hp).toBe(30);
      expect(engine.messages.some((m) => m.includes('*** CRITICAL HIT! ***'))).toBe(true);
    });

    it('supports custom calculateDamage formulas on manifest', () => {
      const combatConfig: CombatConfig = {
        calculateDamage: () => {
          // Custom formula: flat 42 pure chaos damage regardless of stats
          return { damage: 42, isCrit: true };
        },
      };

      const { engine, player } = createEngine({
        id: 'custom-formula',
        name: 'Custom Formula Test',
        combatConfig,
      });

      const defender = new Monster({
        id: 'boss',
        name: 'Ancient Boss',
        position: { x: 5, y: 4 },
        stats: { hp: 100, maxHp: 100, attack: 20, defense: 50 },
      });
      engine.addEntity(defender);

      const action = new MeleeAttackAction(player, defender);
      engine.handlePlayerAction(action);

      expect(defender.hp).toBe(58); // 100 - 42
    });
  });

  describe('ProgressionConfig & Player Leveling', () => {
    it('uses custom XP curve and stat gains when leveling up', () => {
      const progressionConfig: ProgressionConfig = {
        baseXp: 50,
        xpExponent: 1.0, // Flat 50 XP per level
        statGains: {
          maxHp: 12,
          maxMana: 8,
          strength: 3,
          baseAttack: 3,
          baseDefense: 2,
        },
      };

      const { player } = createEngine({
        id: 'progression-test',
        name: 'Progression Test',
        progressionConfig,
      });

      expect(player.level).toBe(1);
      expect(player.xpToNextLevel).toBe(50);

      // Gain 50 XP -> Level 2
      const res = player.gainXp(50);
      expect(res.leveledUp).toBe(true);
      expect(res.newLevel).toBe(2);
      expect(player.maxHp).toBe(62); // 50 + 12
      expect(player.hp).toBe(62); // fully restored on level up
      expect(player.strength).toBe(18); // 15 + 3
      expect(player.attack).toBe(13); // 10 + 3
      expect(player.defense).toBe(6); // 4 + 2
      expect(res.statGains?.maxHp).toBe(12);
    });

    it('supports dynamic stat gains function per level', () => {
      const progressionConfig: ProgressionConfig = {
        getXpForNextLevel: (level) => level * 100,
        statGains: (newLevel) => ({
          maxHp: newLevel * 10,
          strength: newLevel,
        }),
      };

      const { player } = createEngine({
        id: 'dynamic-gains',
        name: 'Dynamic Gains Test',
        progressionConfig,
      });

      const res = player.gainXp(100);
      expect(res.leveledUp).toBe(true);
      expect(res.newLevel).toBe(2);
      expect(player.maxHp).toBe(70); // 50 + (2 * 10) = 70
    });

    it('enforces maxLevel cap', () => {
      const progressionConfig: ProgressionConfig = {
        baseXp: 10,
        maxLevel: 2,
      };

      const { player } = createEngine({
        id: 'cap-test',
        name: 'Cap Test',
        progressionConfig,
      });

      player.gainXp(10);
      expect(player.level).toBe(2);

      // More XP does not level up past maxLevel 2
      const res = player.gainXp(1000);
      expect(res.leveledUp).toBe(false);
      expect(player.level).toBe(2);
    });

    it('integrates with DeathResolver when killing a monster', () => {
      const progressionConfig: ProgressionConfig = {
        baseXp: 20,
        statGains: {
          maxHp: 20,
          strength: 5,
        },
      };

      const { engine, player } = createEngine({
        id: 'kill-level-test',
        name: 'Kill Level Test',
        progressionConfig,
      });

      const monster = new Monster({
        id: 'elite-goblin',
        name: 'Elite Goblin',
        position: { x: 5, y: 4 },
        stats: { hp: 10, maxHp: 10, attack: 2, defense: 0 },
        xpValue: 25, // awards 25 XP (triggers level up with baseXp 20)
      });
      engine.addEntity(monster);

      DeathResolver.resolveDeath(engine, player, monster);

      expect(player.level).toBe(2);
      expect(player.maxHp).toBe(70); // 50 + 20
      expect(engine.messages.some((m) => m.includes('*** LEVEL UP! Welcome to Level 2! ***'))).toBe(true);
      expect(engine.messages.some((m) => m.includes('+20 Max HP'))).toBe(true);
    });
  });

  describe('Warcraft: Orcs & Humans Manifest Integration', () => {
    it('wires Warcraft featureFlags, combatConfig, and progressionConfig', () => {
      expect(warcraftManifest.featureFlags).toBeDefined();
      expect(warcraftManifest.featureFlags?.bloodlustMechanic).toBe(true);
      expect(warcraftManifest.combatConfig).toBeDefined();
      expect(warcraftManifest.combatConfig?.critMultiplier).toBe(2.0);
      expect(warcraftManifest.progressionConfig).toBeDefined();
      expect(warcraftManifest.progressionConfig?.baseXp).toBe(120);

      const { engine, player } = createEngine(warcraftManifest);
      expect(engine.hasFeature('bloodlustMechanic')).toBe(true);
      expect(player.progressionConfig).toEqual(warcraftManifest.progressionConfig);
      expect(player.xpToNextLevel).toBe(120);
    });
  });
});
