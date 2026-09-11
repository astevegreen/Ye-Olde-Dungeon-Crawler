import { describe, it, expect, vi } from 'vitest';
import { CompendiumManager } from '../compendiumManager';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { MeleeAttackAction } from '../../actions/combat';
import { DeathResolver } from '../../combat/deathResolver';
import { serializeGame, deserializeGame } from '../../storage/serializer';

describe('Slayer Compendium & Progressive Monster Mastery', () => {
  it('starts at Tier 0 (Undiscovered) and advances to Tier 1 upon encounter', () => {
    const manager = new CompendiumManager();
    expect(manager.getTier('giant_rat')).toBe(0);

    const encounterRes = manager.recordEncounter('giant_rat', 'Giant Rat', 1);
    expect(encounterRes.advanced).toBe(true);
    expect(manager.getTier('giant_rat')).toBe(1);
    expect(manager.getEntry('giant_rat').kills).toBe(0);
    expect(manager.getEntry('giant_rat').firstEncounterFloor).toBe(1);

    // Duplicate encounters do not re-advance
    const secondEncounter = manager.recordEncounter('giant_rat', 'Giant Rat', 2);
    expect(secondEncounter.advanced).toBe(false);
    expect(manager.getTier('giant_rat')).toBe(1);
  });

  it('progresses to Tier 2 on 1st kill, and Tier 3 (Mastered) on 5th kill', () => {
    const manager = new CompendiumManager();
    manager.recordEncounter('kobold', 'Kobold', 1);
    expect(manager.getTier('kobold')).toBe(1);

    // Kill 1 -> Tier 2
    const k1 = manager.recordKill('kobold', 'Kobold');
    expect(k1.kills).toBe(1);
    expect(k1.tier).toBe(2);
    expect(k1.tierAdvanced).toBe(true);

    // Kills 2, 3, 4 -> Remain Tier 2
    const k2 = manager.recordKill('kobold');
    expect(k2.kills).toBe(2);
    expect(k2.tier).toBe(2);
    expect(k2.tierAdvanced).toBe(false);

    manager.recordKill('kobold'); // 3
    manager.recordKill('kobold'); // 4
    expect(manager.getTier('kobold')).toBe(2);
    expect(manager.hasMastery('kobold')).toBe(false);

    // Kill 5 -> Tier 3 (Mastered!)
    const k5 = manager.recordKill('kobold');
    expect(k5.kills).toBe(5);
    expect(k5.tier).toBe(3);
    expect(k5.tierAdvanced).toBe(true);
    expect(manager.hasMastery('kobold')).toBe(true);
    expect(manager.getMasteryDamageBonus('kobold')).toBe(1);
    expect(manager.getMasteryEvasionBonus('kobold')).toBe(0.05);
  });

  it('applies +1 flat attack damage perk in combat against mastered monsters', () => {
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 1, y: 1 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
    });
    const monster = new Monster({
      id: 'm1',
      definitionId: 'goblin',
      name: 'Goblin',
      position: { x: 1, y: 2 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 3 },
    });

    const compendium = new CompendiumManager();
    const engine = new GameEngine({ map, player, compendium });
    engine.addEntity(monster);

    // Without mastery: Attack 10 - Defense 3 = 7 damage
    const action1 = new MeleeAttackAction(player, monster);
    const res1 = action1.perform(engine);
    expect(res1.success).toBe(true);
    expect(monster.hp).toBe(50 - 7); // 43

    // Unlock Tier 3 mastery (5 kills)
    for (let i = 0; i < 5; i++) {
      compendium.recordKill('goblin', 'Goblin');
    }
    expect(compendium.hasMastery('goblin')).toBe(true);

    // With mastery: Attack 10 + 1 (Mastery) - Defense 3 = 8 damage
    const action2 = new MeleeAttackAction(player, monster);
    const res2 = action2.perform(engine);
    expect(res2.success).toBe(true);
    expect(monster.hp).toBe(43 - 8); // 35
    expect(res2.message).toContain('(+1 Mastery Perk)');
  });

  it('evades monster attacks when evasion perk triggers on mastered monsters', () => {
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 1, y: 1 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
    });
    const monster = new Monster({
      id: 'm1',
      definitionId: 'ogre',
      name: 'Ogre Brute',
      position: { x: 1, y: 2 },
      stats: { hp: 50, maxHp: 50, attack: 15, defense: 3 },
    });

    const compendium = new CompendiumManager();
    for (let i = 0; i < 5; i++) {
      compendium.recordKill('ogre', 'Ogre Brute');
    }
    expect(compendium.hasMastery('ogre')).toBe(true);

    const engine = new GameEngine({ map, player, compendium });
    engine.addEntity(monster);

    // Mock Math.random to return 0.02 (< 0.05 evasion threshold)
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.02);

    const action = new MeleeAttackAction(monster, player);
    const res = action.perform(engine);

    expect(res.success).toBe(true);
    expect(res.message).toContain('anticipates Ogre Brute\'s attack and evades cleanly');
    expect(player.hp).toBe(50); // No damage taken!

    randomSpy.mockRestore();
  });

  it('DeathResolver automatically records kills and advances mastery tier', () => {
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 1, y: 1 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
    });
    const monster = new Monster({
      id: 'm-death-test',
      definitionId: 'troll',
      name: 'Cave Troll',
      position: { x: 1, y: 2 },
      stats: { hp: 10, maxHp: 10, attack: 5, defense: 2 },
    });

    const compendium = new CompendiumManager();
    const engine = new GameEngine({ map, player, compendium });
    engine.addEntity(monster);

    expect(compendium.getTier('troll')).toBe(0);

    DeathResolver.resolveDeath(engine, player, monster);

    expect(compendium.getTier('troll')).toBe(2);
    expect(compendium.getEntry('troll').kills).toBe(1);
  });

  it('serializes and deserializes compendium state across save/load cycles', () => {
    const manager = new CompendiumManager();
    manager.recordEncounter('giant_rat', 'Giant Rat', 1);
    for (let i = 0; i < 5; i++) {
      manager.recordKill('kobold', 'Kobold');
    }

    const serialized = manager.serialize();
    expect(serialized['giant_rat'].tier).toBe(1);
    expect(serialized['kobold'].tier).toBe(3);
    expect(serialized['kobold'].kills).toBe(5);

    const newManager = new CompendiumManager(serialized);
    expect(newManager.getTier('giant_rat')).toBe(1);
    expect(newManager.hasMastery('kobold')).toBe(true);
    expect(newManager.getMasteryDamageBonus('kobold')).toBe(1);

    // Test full engine save/load roundtrip
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'p1',
      name: 'Thorvald',
      position: { x: 2, y: 2 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
    });
    const engine = new GameEngine({ map, player, compendium: manager });
    const profile = {
      id: 'prof-1',
      name: 'Thorvald',
      level: 1,
      floor: 1,
      lastSaved: Date.now(),
      hp: 30,
      maxHp: 30,
      strength: 15,
    };

    const saveData = serializeGame(engine, profile);
    expect(saveData.compendium).toBeDefined();
    expect(saveData.compendium?.['kobold'].tier).toBe(3);

    const loaded = deserializeGame(saveData);
    expect(loaded.engine.compendium.hasMastery('kobold')).toBe(true);
    expect(loaded.engine.compendium.getTier('giant_rat')).toBe(1);
  });
});
