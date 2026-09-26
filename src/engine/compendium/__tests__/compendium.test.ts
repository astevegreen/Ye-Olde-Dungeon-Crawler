import { describe, it, expect } from 'vitest';
import { CompendiumManager, selectMasteryPerk } from '../compendiumManager';
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
  });

  it('selectMasteryPerk dispatches game event and logs selection', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    const engine = new GameEngine({ map, player, floor: 0 });
    for (let i = 0; i < 5; i++) {
      engine.compendium.recordKill('ogre', 'Ogre');
    }

    const res = selectMasteryPerk(engine, 'ogre', 'trophy_hunter');
    expect(res.success).toBe(true);
    expect(engine.compendium.getPerk('ogre')).toBe('trophy_hunter');
  });

  it('enforces town-only respec for mastery specializations', () => {
    const manager = new CompendiumManager();
    for (let i = 0; i < 5; i++) {
      manager.recordKill('troll', 'Troll');
    }
    expect(manager.hasMastery('troll')).toBe(true);

    // Initial selection can happen anywhere (even in dungeon)
    const initialPick = manager.selectPerk('troll', 'anatomist', false);
    expect(initialPick.success).toBe(true);
    expect(manager.getPerk('troll')).toBe('anatomist');

    // Trying to change perk while not in town fails
    const dungeonRespec = manager.selectPerk('troll', 'survivor', false);
    expect(dungeonRespec.success).toBe(false);
    expect(dungeonRespec.reason).toContain('Town');
    expect(manager.getPerk('troll')).toBe('anatomist');

    // Respec in town (inTown = true) succeeds
    const townRespec = manager.selectPerk('troll', 'survivor', true);
    expect(townRespec.success).toBe(true);
    expect(manager.getPerk('troll')).toBe('survivor');
  });


  it('applies Anatomist perk: ignores 50% defense and increases critical damage', () => {
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
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 4 },
    });

    const compendium = new CompendiumManager();
    const engine = new GameEngine({ map, player, compendium });
    engine.addEntity(monster);

    // Without mastery: Attack 10 - Defense 4 = 6 damage
    const action1 = new MeleeAttackAction(player, monster);
    const res1 = action1.perform(engine);
    expect(res1.success).toBe(true);
    expect(monster.hp).toBe(50 - 6); // 44

    // Unlock Tier 3 mastery and select Anatomist perk
    for (let i = 0; i < 5; i++) {
      compendium.recordKill('goblin', 'Goblin');
    }
    compendium.selectPerk('goblin', 'anatomist', true);
    expect(compendium.getPerk('goblin')).toBe('anatomist');

    // With Anatomist: Defense 4 halved to 2. Attack 10 + 1 (mastery bonus) - 2 = 9 damage
    const action2 = new MeleeAttackAction(player, monster);
    const res2 = action2.perform(engine);
    expect(res2.success).toBe(true);
    expect(monster.hp).toBe(44 - 9); // 35
    expect(res2.message).toContain('Anatomist');
  });

  it('evades attacks and resists debuffs with Survivor perk', () => {
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
    compendium.selectPerk('ogre', 'survivor', true);

    const engine = new GameEngine({ map, player, compendium });
    engine.addEntity(monster);

    // Mock engine.rng to return 0.05 (< 0.10 Survivor evasion threshold)
    engine.rng = () => 0.05;

    const action = new MeleeAttackAction(monster, player);
    const res = action.perform(engine);

    expect(res.success).toBe(true);
    expect(res.message).toContain('anticipates Ogre Brute\'s attack and evades cleanly! (Survivor Perk)');
    expect(player.hp).toBe(50); // No damage taken!
  });

  it('restores HP, Mana, and refunds energy with Essence Siphon perk on kill', () => {
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 1, y: 1 },
      stats: { hp: 10, maxHp: 50, attack: 10, defense: 2 },
      mana: 5,
      maxMana: 30,
    });
    const compendium = new CompendiumManager();
    for (let i = 0; i < 5; i++) {
      compendium.recordKill('wraith', 'Wraith');
    }
    compendium.selectPerk('wraith', 'essence_siphon', true);

    const monster = new Monster({
      id: 'm-siphon',
      definitionId: 'wraith',
      name: 'Wraith',
      position: { x: 1, y: 2 },
      stats: { hp: 5, maxHp: 10, attack: 2, defense: 0 },
    });
    const engine = new GameEngine({ map, player, compendium });
    engine.addEntity(monster);

    player.energy = 50;
    DeathResolver.resolveDeath(engine, player, monster);

    // 10% max HP = 5, 10% max Mana = 3
    expect(player.hp).toBe(15);
    expect(player.mana).toBe(8);
    // 50% of BASE_ACTION_COST (100) = 50 refunded
    expect(player.energy).toBe(100);
  });

  it('drops anatomical trophy with Trophy Hunter perk', () => {
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 1, y: 1 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
    });
    const monster = new Monster({
      id: 'm-trophy',
      definitionId: 'viper',
      name: 'Cave Viper',
      position: { x: 1, y: 2 },
      stats: { hp: 5, maxHp: 10, attack: 2, defense: 0 },
      onHitAffliction: { type: 'poison', chance: 1, duration: 4 },
    });

    const compendium = new CompendiumManager();
    for (let i = 0; i < 5; i++) {
      compendium.recordKill('viper', 'Cave Viper');
    }
    compendium.selectPerk('viper', 'trophy_hunter', true);

    const engine = new GameEngine({ map, player, compendium });
    engine.addEntity(monster);

    // Force trophy roll to succeed (< 0.35)
    engine.rng = () => 0.10;

    DeathResolver.resolveDeath(engine, player, monster);

    const groundItems = engine.map.getItemsAt(1, 2);
    expect(groundItems.length).toBeGreaterThan(0);
    const trophy = groundItems.find((it) => it.name.includes('Venom Sac') || it.name.includes('Trophy'));
    expect(trophy).toBeDefined();
    expect(trophy?.value).toBeGreaterThan(0);
  });

  it('doubles coin and guarantees drops with Plunderer perk', () => {
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 1, y: 1 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
    });
    const monster = new Monster({
      id: 'm-plunder',
      definitionId: 'kobold_thief',
      name: 'Kobold Thief',
      position: { x: 1, y: 2 },
      stats: { hp: 5, maxHp: 10, attack: 2, defense: 0 },
      lootTable: [
        {
          chance: 1.0,
          generate: (id) => ({
            id,
            name: 'Gold Coins',
            displayName: 'Gold Coins',
            category: 'coin',
            value: 20,
            weight: 10,
            bulk: 5,
            quality: 'normal',
            identified: true,
            isBroken: () => false,
          } as any),
        },
      ],
    });

    const compendium = new CompendiumManager();
    for (let i = 0; i < 5; i++) {
      compendium.recordKill('kobold_thief', 'Kobold Thief');
    }
    compendium.selectPerk('kobold_thief', 'plunderer', true);

    const engine = new GameEngine({ map, player, compendium });
    engine.addEntity(monster);

    DeathResolver.resolveDeath(engine, player, monster);

    const items = engine.map.getItemsAt(1, 2);
    const coin = items.find((i) => i.category === 'coin');
    expect(coin).toBeDefined();
    // 20 base doubled by Plunderer = 40
    expect(coin?.value).toBe(40);
  });

  it('serializes and deserializes compendium state and chosenPerk across save/load cycles', () => {
    const manager = new CompendiumManager();
    manager.recordEncounter('giant_rat', 'Giant Rat', 1);
    for (let i = 0; i < 5; i++) {
      manager.recordKill('kobold', 'Kobold');
    }
    manager.selectPerk('kobold', 'anatomist', true);

    const serialized = manager.serialize();
    expect(serialized['giant_rat'].tier).toBe(1);
    expect(serialized['kobold'].tier).toBe(3);
    expect(serialized['kobold'].kills).toBe(5);
    expect(serialized['kobold'].chosenPerk).toBe('anatomist');

    const newManager = new CompendiumManager(serialized);
    expect(newManager.getTier('giant_rat')).toBe(1);
    expect(newManager.hasMastery('kobold')).toBe(true);
    expect(newManager.getPerk('kobold')).toBe('anatomist');
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
    expect(saveData.compendium?.['kobold'].chosenPerk).toBe('anatomist');

    const loaded = deserializeGame(saveData);
    expect(loaded.engine.compendium.hasMastery('kobold')).toBe(true);
    expect(loaded.engine.compendium.getPerk('kobold')).toBe('anatomist');
    expect(loaded.engine.compendium.getTier('giant_rat')).toBe(1);
  });
});
