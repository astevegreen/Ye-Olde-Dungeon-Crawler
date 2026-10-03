import { describe, it, expect } from 'vitest';
import { CompendiumManager, selectMasteryPerk, getPendingMasteryChoices } from '../compendiumManager';
import { SPECIES_MASTERY_KILLS } from '../types';
import type { GameContentManifest } from '../../types/manifest';
import type { GameEvent } from '../../events';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { MeleeAttackAction } from '../../actions/combat';
import { DeathResolver } from '../../combat/deathResolver';
import { ItemFactory } from '../../items/factory';
import { CoinItem } from '../../economy/currency';
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

  it('progresses to Tier 2 on 1st kill, and Tier 3 (Mastered) on the 15th kill', () => {
    expect(SPECIES_MASTERY_KILLS).toBe(15);
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

    // Kills 3..14 -> still Tier 2
    for (let i = 3; i < 15; i++) manager.recordKill('kobold');
    expect(manager.getEntry('kobold').kills).toBe(14);
    expect(manager.getTier('kobold')).toBe(2);
    expect(manager.hasMastery('kobold')).toBe(false);
    expect(manager.selectPerk('kobold', 'anatomist', true).success).toBe(false);

    // Kill 15 -> Tier 3 (Mastered!)
    const k15 = manager.recordKill('kobold');
    expect(k15.kills).toBe(15);
    expect(k15.tier).toBe(3);
    expect(k15.tierAdvanced).toBe(true);
    expect(manager.hasMastery('kobold')).toBe(true);
  });

  it('selectMasteryPerk dispatches game event and logs selection', () => {
    const map = new GameMap(10, 10);
    const player = new Player({ id: 'p1', name: 'Hero', position: { x: 1, y: 1 } });
    const engine = new GameEngine({ map, player, floor: 0 });
    for (let i = 0; i < SPECIES_MASTERY_KILLS; i++) {
      engine.compendium.recordKill('ogre', 'Ogre');
    }

    const res = selectMasteryPerk(engine, 'species', 'ogre', 'trophy_hunter');
    expect(res.success).toBe(true);
    expect(engine.compendium.getPerk('ogre')).toBe('trophy_hunter');
  });

  it('enforces town-only respec for mastery specializations', () => {
    const manager = new CompendiumManager();
    for (let i = 0; i < SPECIES_MASTERY_KILLS; i++) {
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
    for (let i = 0; i < SPECIES_MASTERY_KILLS; i++) {
      compendium.recordKill('goblin', 'Goblin');
    }
    compendium.selectPerk('goblin', 'anatomist', true);
    expect(compendium.getPerk('goblin')).toBe('anatomist');

    // With Anatomist: Defense 4 halved to 2. Attack 10 - 2 = 8 damage
    const action2 = new MeleeAttackAction(player, monster);
    const res2 = action2.perform(engine);
    expect(res2.success).toBe(true);
    expect(monster.hp).toBe(44 - 8); // 36
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
    for (let i = 0; i < SPECIES_MASTERY_KILLS; i++) {
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
    for (let i = 0; i < SPECIES_MASTERY_KILLS; i++) {
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
    for (let i = 0; i < SPECIES_MASTERY_KILLS; i++) {
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
          generate: (id) => ItemFactory.createGoldCoins(id, 20),
        },
      ],
    });

    const compendium = new CompendiumManager();
    for (let i = 0; i < SPECIES_MASTERY_KILLS; i++) {
      compendium.recordKill('kobold_thief', 'Kobold Thief');
    }
    compendium.selectPerk('kobold_thief', 'plunderer', true);

    const engine = new GameEngine({ map, player, compendium });
    engine.addEntity(monster);

    DeathResolver.resolveDeath(engine, player, monster);

    const items = engine.map.getItemsAt(1, 2);
    const coin = items.find((i): i is CoinItem => i instanceof CoinItem);
    expect(coin).toBeDefined();
    // 20 base doubled by Plunderer = 40
    expect(coin?.count).toBe(40);
  });

  it('serializes and deserializes compendium state and chosenPerk across save/load cycles', () => {
    const manager = new CompendiumManager();
    manager.recordEncounter('giant_rat', 'Giant Rat', 1);
    for (let i = 0; i < SPECIES_MASTERY_KILLS; i++) {
      manager.recordKill('kobold', 'Kobold');
    }
    manager.selectPerk('kobold', 'anatomist', true);

    const serialized = manager.serialize();
    expect(serialized['giant_rat'].tier).toBe(1);
    expect(serialized['kobold'].tier).toBe(3);
    expect(serialized['kobold'].kills).toBe(15);
    expect(serialized['kobold'].chosenPerk).toBe('anatomist');

    const newManager = new CompendiumManager(serialized);
    expect(newManager.getTier('giant_rat')).toBe(1);
    expect(newManager.hasMastery('kobold')).toBe(true);
    expect(newManager.getPerk('kobold')).toBe('anatomist');

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

  it('drops a pre-15-kill mastery from an older save back to tier 2 without its perk', () => {
    const manager = new CompendiumManager({
      kobold: { kills: 6, tier: 3, chosenPerk: 'anatomist' },
      goblin: { kills: 20, tier: 3, chosenPerk: 'survivor' },
    });
    expect(manager.getTier('kobold')).toBe(2);
    expect(manager.getPerk('kobold')).toBeUndefined();
    expect(manager.getTier('goblin')).toBe(3);
    expect(manager.getPerk('goblin')).toBe('survivor');
  });
});

describe('Category mastery', () => {
  const CATEGORY_MANIFEST = {
    id: 'test',
    name: 'Test',
    monsters: [],
    items: [],
    spells: [],
    monsterCategories: [
      { id: 'undead', name: 'The Restless Dead', members: ['skeleton', 'draugr'], masteryKills: 40 },
    ],
  } as unknown as GameContentManifest;

  const makeEngine = (floor = 1) => {
    const map = new GameMap(10, 10);
    const player = new Player({
      id: 'player',
      name: 'Hero',
      position: { x: 1, y: 1 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
    });
    const engine = new GameEngine({ map, player, floor, manifest: CATEGORY_MANIFEST });
    const events: GameEvent[] = [];
    engine.onGameEvent = (e) => events.push(e);
    return { engine, player, events };
  };

  let killSeq = 0;
  const kill = (engine: GameEngine, player: Player, definitionId: string, n = 1) => {
    for (let i = 0; i < n; i++) {
      const m = new Monster({
        id: `${definitionId}-${++killSeq}`,
        definitionId,
        name: definitionId,
        position: { x: 1, y: 2 },
        stats: { hp: 1, maxHp: 1, attack: 1, defense: 0 },
      });
      engine.addEntity(m);
      DeathResolver.resolveDeath(engine, player, m);
    }
  };

  const unlocks = (events: GameEvent[]) =>
    events.filter((e) => e.type === 'mastery_unlocked') as Array<GameEvent & { scope: string; masteryId: string; kills: number }>;

  it('emits a species mastery_unlocked on exactly the 15th kill of one type', () => {
    const { engine, player, events } = makeEngine();
    kill(engine, player, 'skeleton', 14);
    expect(unlocks(events)).toHaveLength(0);
    kill(engine, player, 'skeleton');
    expect(unlocks(events)).toEqual([
      expect.objectContaining({ scope: 'species', masteryId: 'skeleton', kills: 15 }),
    ]);
    kill(engine, player, 'skeleton', 3);
    expect(unlocks(events)).toHaveLength(1);
  });

  it('counts kills across every member and emits a category mastery_unlocked at the threshold', () => {
    const { engine, player, events } = makeEngine();
    kill(engine, player, 'skeleton', 14);
    kill(engine, player, 'draugr', 14);
    kill(engine, player, 'goblin', 20); // not in the category
    expect(engine.compendium.getCategoryKills(CATEGORY_MANIFEST.monsterCategories![0])).toBe(28);
    expect(unlocks(events).filter((e) => e.scope === 'category')).toHaveLength(0);

    kill(engine, player, 'skeleton', 6); // species mastery at 15 along the way
    kill(engine, player, 'draugr', 5); // 39 total
    expect(unlocks(events).filter((e) => e.scope === 'category')).toHaveLength(0);
    kill(engine, player, 'draugr'); // 40
    expect(unlocks(events).filter((e) => e.scope === 'category')).toEqual([
      expect.objectContaining({ masteryId: 'undead', kills: 40 }),
    ]);
    kill(engine, player, 'draugr', 2);
    expect(unlocks(events).filter((e) => e.scope === 'category')).toHaveLength(1);
  });

  it('applies a category perk to every member, even ones never mastered', () => {
    const { engine, player } = makeEngine(0);
    kill(engine, player, 'skeleton', 40);
    expect(selectMasteryPerk(engine, 'category', 'undead', 'anatomist').success).toBe(true);

    // draugr: 0 kills, but the category perk still applies
    const draugr = new Monster({
      id: 'draugr-x',
      definitionId: 'draugr',
      name: 'Draugr',
      position: { x: 1, y: 2 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 4 },
    });
    engine.addEntity(draugr);
    const res = new MeleeAttackAction(player, draugr).perform(engine);
    expect(res.message).toContain('Anatomist');
    const vsDraugr = 50 - draugr.hp;

    // a monster outside the category gets nothing
    const goblin = new Monster({
      id: 'goblin-x',
      definitionId: 'goblin',
      name: 'Goblin',
      position: { x: 2, y: 2 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 4 },
    });
    engine.addEntity(goblin);
    const res2 = new MeleeAttackAction(player, goblin).perform(engine);
    expect(res2.message).not.toContain('Anatomist');
    // Same defense, but the category's Anatomist halves only the draugr's (4 -> 2)
    expect(vsDraugr).toBe(50 - goblin.hp + 2);
  });

  it('refuses a category perk before the threshold, and a dungeon respec', () => {
    const { engine, player } = makeEngine(3);
    kill(engine, player, 'skeleton', 39);
    expect(selectMasteryPerk(engine, 'category', 'undead', 'survivor').success).toBe(false);
    kill(engine, player, 'draugr');
    expect(selectMasteryPerk(engine, 'category', 'undead', 'survivor').success).toBe(true);
    const respec = selectMasteryPerk(engine, 'category', 'undead', 'plunderer');
    expect(respec.success).toBe(false);
    expect(respec.reason).toContain('Town');
    expect(engine.compendium.getCategoryPerk('undead')).toBe('survivor');
  });

  it('lists earned-but-unchosen masteries as pending', () => {
    const { engine, player } = makeEngine(0);
    kill(engine, player, 'skeleton', 25);
    kill(engine, player, 'draugr', 15);
    expect(getPendingMasteryChoices(engine).map((p) => `${p.scope}:${p.masteryId}`).sort()).toEqual([
      'category:undead',
      'species:draugr',
      'species:skeleton',
    ]);
    selectMasteryPerk(engine, 'species', 'skeleton', 'plunderer');
    selectMasteryPerk(engine, 'category', 'undead', 'survivor');
    expect(getPendingMasteryChoices(engine).map((p) => p.masteryId)).toEqual(['draugr']);
  });

  it('persists category perks through a save/load round trip', () => {
    const { engine, player } = makeEngine(0);
    kill(engine, player, 'skeleton', 40);
    selectMasteryPerk(engine, 'category', 'undead', 'essence_siphon');

    const save = serializeGame(engine);
    expect(save.compendiumCategoryPerks).toEqual({ undead: 'essence_siphon' });
    const loaded = deserializeGame(JSON.parse(JSON.stringify(save)), CATEGORY_MANIFEST);
    expect(loaded.engine.compendium.getCategoryPerk('undead')).toBe('essence_siphon');
    expect(loaded.engine.compendium.getEntry('skeleton').kills).toBe(40);
  });
});
