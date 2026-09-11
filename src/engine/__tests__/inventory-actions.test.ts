import { describe, it, expect } from 'vitest';
import { GameMap } from '../grid/map';
import { GameEngine } from '../engine';
import { Player } from '../entities/player';
import { ItemFactory } from '../items/factory';
import { PickUpAction, DropAction, EquipAction, UnequipAction } from '../actions/inventory-actions';

describe('Inventory Actions', () => {
  it('picks up items from the ground into player pack', () => {
    const map = GameMap.createBoxRoom(10, 10);
    const player = new Player({ position: { x: 3, y: 3 }, strength: 15 });
    const engine = new GameEngine({ map, player });

    const sword = ItemFactory.createBroadsword('ground-sword');
    map.addItemAt(3, 3, sword);

    expect(map.getItemsAt(3, 3)).toHaveLength(1);
    expect(player.inventory.primaryPack.hasItem('ground-sword')).toBe(false);

    player.gainEnergy(100);
    const pickAction = new PickUpAction(player);
    const result = pickAction.perform(engine);

    expect(result.success).toBe(true);
    expect(map.getItemsAt(3, 3)).toHaveLength(0);
    expect(player.inventory.primaryPack.hasItem('ground-sword')).toBe(true);
  });

  it('fails pick up if ground is empty', () => {
    const map = GameMap.createBoxRoom(10, 10);
    const player = new Player({ position: { x: 3, y: 3 } });
    const engine = new GameEngine({ map, player });

    const pickAction = new PickUpAction(player);
    const result = pickAction.perform(engine);

    expect(result.success).toBe(false);
    expect(result.message).toContain('nothing here to pick up');
  });

  it('drops item from pack onto ground', () => {
    const map = GameMap.createBoxRoom(10, 10);
    const player = new Player({ position: { x: 3, y: 3 } });
    const engine = new GameEngine({ map, player });

    const dagger = ItemFactory.createDagger('dag-drop');
    player.inventory.primaryPack.addItem(dagger);

    player.gainEnergy(100);
    const dropAction = new DropAction(player, dagger, 'pack');
    const result = dropAction.perform(engine);

    expect(result.success).toBe(true);
    expect(player.inventory.primaryPack.hasItem('dag-drop')).toBe(false);
    expect(map.getItemsAt(3, 3)).toHaveLength(1);
    expect(map.getItemsAt(3, 3)[0].id).toBe('dag-drop');
  });

  it('equips item from pack and unequips back to pack', () => {
    const map = GameMap.createBoxRoom(10, 10);
    const player = new Player({ position: { x: 3, y: 3 } });
    const engine = new GameEngine({ map, player });

    const shield = ItemFactory.createWoodenShield('shield-eq');
    player.inventory.primaryPack.addItem(shield);

    player.gainEnergy(100);
    const equipAction = new EquipAction(player, 'shield-eq');
    const equipResult = equipAction.perform(engine);

    expect(equipResult.success).toBe(true);
    expect(player.inventory.paperdoll.getItem('offHand')?.id).toBe('shield-eq');
    expect(player.inventory.primaryPack.hasItem('shield-eq')).toBe(false);

    player.gainEnergy(100);
    const unequipAction = new UnequipAction(player, 'offHand');
    const unequipResult = unequipAction.perform(engine);

    expect(unequipResult.success).toBe(true);
    expect(player.inventory.paperdoll.getItem('offHand')).toBeNull();
    expect(player.inventory.primaryPack.hasItem('shield-eq')).toBe(true);
  });

  it('identifies and binds cursed item when equipped, preventing unequip', () => {
    const map = GameMap.createBoxRoom(10, 10);
    const player = new Player({ position: { x: 3, y: 3 } });
    const engine = new GameEngine({ map, player });

    const cursedMace = ItemFactory.createCursedMace('curse-1');
    expect(cursedMace.identified).toBe(false);
    player.inventory.primaryPack.addItem(cursedMace);

    player.gainEnergy(100);
    const equipAction = new EquipAction(player, 'curse-1');
    const equipResult = equipAction.perform(engine);

    expect(equipResult.success).toBe(true);
    expect(cursedMace.identified).toBe(true);
    expect(equipResult.message).toContain('cursed and binds tightly');

    // Attempting to unequip fails
    const unequipAction = new UnequipAction(player, 'mainHand');
    const unequipResult = unequipAction.perform(engine);

    expect(unequipResult.success).toBe(false);
    expect(unequipResult.message).toContain('cursed and bound');
    expect(player.inventory.paperdoll.getItem('mainHand')?.id).toBe('curse-1');
  });
});
