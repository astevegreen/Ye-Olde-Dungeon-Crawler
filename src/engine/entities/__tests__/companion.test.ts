import { describe, it, expect, beforeEach } from 'vitest';
import { Companion, CompanionRegistry } from '../companion';
import { Monster } from '../monster';
import { Player } from '../player';

describe('Companion (docs/architecture/content-companions.md, Phase 1 MVP)', () => {
  it('is player-aligned: not hostile to the player, and hostile monsters are hostile to it', () => {
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 0, y: 0 } });
    const companion = new Companion({
      id: 'comp-1',
      name: 'Test Hound',
      position: { x: 1, y: 0 },
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
      speed: 100,
      companionDefinitionId: 'test_hound',
      packWeightCapacity: 10000,
      packBulkCapacity: 8000,
    });
    const hostile = new Monster({
      id: 'wolf-1',
      name: 'Wolf',
      position: { x: 2, y: 0 },
      stats: { hp: 15, maxHp: 15, attack: 4, defense: 1 },
      speed: 100,
      definitionId: 'wolf',
      aiType: 'melee',
      fleeHealthPercent: 0,
      xpValue: 5,
      lootTable: [],
    });

    expect(companion.isHostileTo(player)).toBe(false);
    expect(player.isHostileTo(companion)).toBe(false);
    expect(companion.isHostileTo(hostile)).toBe(true);
    expect(hostile.isHostileTo(companion)).toBe(true);
  });

  it('is registered with the companion_follow AI routine and never starts asleep', () => {
    const companion = new Companion({
      id: 'comp-2',
      name: 'Test Hound',
      position: { x: 0, y: 0 },
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
      speed: 100,
      companionDefinitionId: 'test_hound',
      packWeightCapacity: 10000,
      packBulkCapacity: 8000,
    });

    expect(companion.aiRoutineId).toBe('companion_follow');
    expect(companion.aiState).not.toBe('sleeping');
    expect(companion.fleeHealthPercent).toBe(0);
  });

  it('has its own pack-mule inventory with the configured capacity', () => {
    const companion = new Companion({
      id: 'comp-3',
      name: 'Test Hound',
      position: { x: 0, y: 0 },
      stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
      speed: 100,
      companionDefinitionId: 'test_hound',
      packWeightCapacity: 12345,
      packBulkCapacity: 6789,
    });

    expect(companion.inventory.primaryPack.maxWeightCapacity).toBe(12345);
    expect(companion.inventory.primaryPack.maxBulkCapacity).toBe(6789);
  });

  describe('createFromDefinition / CompanionRegistry', () => {
    beforeEach(() => {
      CompanionRegistry.clear();
    });

    it('constructs a companion from a registered definition', () => {
      CompanionRegistry.register({
        id: 'battle_hound',
        name: 'Battle-Hound',
        stats: { hp: 30, maxHp: 30, attack: 6, defense: 2 },
        speed: 110,
        packWeightCapacity: 15000,
        packBulkCapacity: 12000,
      });

      const companion = Companion.fromDefinition('battle_hound', 'comp-4', { x: 3, y: 3 });

      expect(companion).not.toBeNull();
      expect(companion!.name).toBe('Battle-Hound');
      expect(companion!.companionDefinitionId).toBe('battle_hound');
      expect(companion!.hp).toBe(30);
      expect(companion!.x).toBe(3);
      expect(companion!.y).toBe(3);
    });

    it('returns null for an unregistered definition ID', () => {
      expect(Companion.fromDefinition('unknown', 'comp-5', { x: 0, y: 0 })).toBeNull();
    });
  });

  describe('setArchetype / unlockSkill (docs/architecture/content-companions.md Phase 2)', () => {
    it('starts as "balanced" with the companion_follow AI routine', () => {
      const companion = new Companion({
        id: 'comp-6',
        name: 'Test Hound',
        position: { x: 0, y: 0 },
        stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
        speed: 100,
        companionDefinitionId: 'test_hound',
        packWeightCapacity: 10000,
        packBulkCapacity: 8000,
      });

      expect(companion.archetype).toBe('balanced');
      expect(companion.aiRoutineId).toBe('companion_follow');
    });

    it('switches archetype and its backing AI routine together', () => {
      const companion = new Companion({
        id: 'comp-7',
        name: 'Test Hound',
        position: { x: 0, y: 0 },
        stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
        speed: 100,
        companionDefinitionId: 'test_hound',
        packWeightCapacity: 10000,
        packBulkCapacity: 8000,
      });

      companion.setArchetype('bodyguard');
      expect(companion.archetype).toBe('bodyguard');
      expect(companion.aiRoutineId).toBe('companion_bodyguard');

      companion.setArchetype('skirmisher');
      expect(companion.archetype).toBe('skirmisher');
      expect(companion.aiRoutineId).toBe('companion_skirmisher');
    });

    it('unlocks a skill once and refuses to unlock the same skill twice', () => {
      const companion = new Companion({
        id: 'comp-8',
        name: 'Test Hound',
        position: { x: 0, y: 0 },
        stats: { hp: 20, maxHp: 20, attack: 5, defense: 1 },
        speed: 100,
        companionDefinitionId: 'test_hound',
        packWeightCapacity: 10000,
        packBulkCapacity: 8000,
      });

      expect(companion.unlockSkill('rally_howl')).toBe(true);
      expect(companion.unlockedSkills).toEqual(['rally_howl']);
      expect(companion.unlockSkill('rally_howl')).toBe(false);
      expect(companion.unlockedSkills).toEqual(['rally_howl']);
    });
  });
});
