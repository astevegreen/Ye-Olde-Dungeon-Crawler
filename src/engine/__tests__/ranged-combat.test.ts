import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { Item } from '../items/item';
import { RangedAttackAction } from '../actions/rangedAttack';

describe('Physical Ranged Combat & Ammunition Pipeline', () => {
  function setupArena() {
    const map = new GameMap(20, 10, TILES.FLOOR);
    // Add outer walls
    for (let x = 0; x < 20; x++) {
      map.setTile(x, 0, TILES.WALL);
      map.setTile(x, 9, TILES.WALL);
    }
    for (let y = 0; y < 10; y++) {
      map.setTile(0, y, TILES.WALL);
      map.setTile(19, y, TILES.WALL);
    }

    const player = new Player({
      id: 'ranger',
      name: 'Robin',
      position: { x: 2, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
      dexterity: 16, // +3 damage bonus
      mana: 30,
      maxMana: 30,
    });

    const monster = new Monster({
      id: 'goblin-1',
      name: 'Goblin Scout',
      position: { x: 6, y: 5 },
      stats: { hp: 20, maxHp: 20, attack: 6, defense: 2 },
    });

    map.addEntity(player);
    map.addEntity(monster);

    const engine = new GameEngine({ map, player });
    return { engine, map, player, monster };
  }

  it('executes ranged attack with bow requiring arrows, consuming 1 arrow and no mana', () => {
    const { engine, player, monster } = setupArena();

    const shortbow = new Item({
      id: 'bow-1',
      name: 'Hunting Bow',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1200,
      bulk: 3000,
      stats: { attackBonus: 8 },
      rangedConfig: {
        range: 8,
        ammoType: 'arrow',
        baseDamage: 8,
      },
    });

    const arrows = new Item({
      id: 'arrow-bundle-1',
      name: 'Bundle of Iron Arrows',
      category: 'misc',
      weight: 500,
      bulk: 500,
    });

    player.inventory.paperdoll.equip(shortbow, 'mainHand');
    player.inventory.primaryPack.addItem(arrows);

    expect(player.inventory.primaryPack.getItems()).toHaveLength(1);
    const initialMana = player.mana;

    const action = new RangedAttackAction(player, monster.x, monster.y);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    // Ammunition consumed
    expect(player.inventory.primaryPack.getItems()).toHaveLength(0);
    // Zero mana consumed for physical ranged combat
    expect(player.mana).toBe(initialMana);
  });

  it("rolls to hit with the shooter's own DEX", () => {
    // hit% = 75 + (DEX - 10) * 2 - DEF * 2; against DEF 2 that is 87% at DEX 18 and 63% at
    // DEX 6. A fixed roll of 70 separates them. (Before 2026-09-22 every shot used DEX 14.)
    const shoot = (dexterity: number) => {
      const { engine, player, monster } = setupArena();
      player.dexterity = dexterity;
      const bow = new Item({
        id: 'bow-dex', name: 'Hunting Bow', category: 'weapon', slot: 'mainHand', weight: 1200, bulk: 3000,
        stats: { attackBonus: 8 }, rangedConfig: { range: 8, ammoType: 'arrow', baseDamage: 8 },
      });
      player.inventory.paperdoll.equip(bow, 'mainHand');
      player.inventory.primaryPack.addItem(new Item({ id: 'arrows-dex', name: 'Iron Arrows', category: 'misc', weight: 500, bulk: 500 }));
      engine.rng = () => 0.7;
      const hpBefore = monster.hp;
      new RangedAttackAction(player, monster.x, monster.y).perform(engine);
      return monster.hp < hpBefore;
    };

    expect(shoot(18)).toBe(true);
    expect(shoot(6)).toBe(false);
  });

  it('fails gracefully when out of ammunition without spending energy', () => {
    const { engine, player, monster } = setupArena();

    const shortbow = new Item({
      id: 'bow-1',
      name: 'Hunting Bow',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1200,
      bulk: 3000,
      rangedConfig: {
        range: 8,
        ammoType: 'arrow',
      },
    });

    player.inventory.paperdoll.equip(shortbow, 'mainHand');
    // No arrows in pack!

    const initialEnergy = player.energy;
    const action = new RangedAttackAction(player, monster.x, monster.y);
    const result = action.perform(engine);

    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
    expect(result.message).toContain('Out of arrow');
    expect(player.energy).toBe(initialEnergy);
  });

  it('handles self-consuming thrown weapons (throwing dagger)', () => {
    const { engine, player, monster } = setupArena();

    const throwingDagger = new Item({
      id: 'tdag-1',
      name: 'Throwing Dagger',
      category: 'weapon',
      slot: 'mainHand',
      weight: 300,
      bulk: 300,
      rangedConfig: {
        range: 5,
        consumesSelf: true,
        baseDamage: 6,
      },
    });

    player.inventory.paperdoll.equip(throwingDagger, 'mainHand');
    expect(player.inventory.paperdoll.getItem('mainHand')?.id).toBe('tdag-1');

    const action = new RangedAttackAction(player, monster.x, monster.y);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    // Throwing dagger is removed from mainHand slot after throw
    expect(player.inventory.paperdoll.getItem('mainHand')).toBeNull();
  });

  it('rejects targets beyond maximum range', () => {
    const { engine, player, monster } = setupArena();

    const javelin = new Item({
      id: 'jav-1',
      name: 'Javelin',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1000,
      bulk: 1000,
      rangedConfig: {
        range: 3, // Range 3 tiles
        consumesSelf: true,
      },
    });

    player.inventory.paperdoll.equip(javelin, 'mainHand');

    // Monster is at (6, 5) and Player is at (2, 5) -> distance = 4 tiles > range 3
    const action = new RangedAttackAction(player, monster.x, monster.y);
    const result = action.perform(engine);

    expect(result.success).toBe(false);
    expect(result.cost).toBe(0);
    expect(result.message).toContain('out of range');
  });

  it('handles wall collisions along trajectory', () => {
    const { engine, map, player } = setupArena();

    // Place a solid wall between player (2, 5) and target (7, 5)
    map.setTile(4, 5, TILES.WALL);

    const bow = new Item({
      id: 'bow-1',
      name: 'Composite Bow',
      category: 'weapon',
      slot: 'mainHand',
      weight: 1500,
      bulk: 2000,
      rangedConfig: {
        range: 10,
        baseDamage: 10,
      },
    });

    player.inventory.paperdoll.equip(bow, 'mainHand');

    const action = new RangedAttackAction(player, 7, 5);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(result.message).toContain('hits the wall');
  });
});
