import { describe, it, expect, beforeEach, vi, type MockInstance } from 'vitest';
import { InventoryController, cellLabel } from '../inventory/inventoryController';
import { Companion, Container, GameEngine, GameMap, Item, Player, PotionItem } from '../../engine';

const key = (code: string, shiftKey = false) => ({ code, key: code, shiftKey, preventDefault: () => {} }) as unknown as KeyboardEvent;

function ware(id: string, name: string, extra: Partial<ConstructorParameters<typeof Item>[0]> = {}): Item {
  return new Item({ id, name, category: 'misc', weight: 100, bulk: 50, ...extra });
}

describe('InventoryController', () => {
  let engine: GameEngine;
  let player: Player;
  let c: InventoryController;
  let dispatch: MockInstance<GameEngine['commandBus']['dispatch']>;
  const sent = () => dispatch.mock.calls.map((call) => (call[0] as { type: string }).type);

  beforeEach(() => {
    player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    engine = new GameEngine({ map: GameMap.createBoxRoom(10, 10), player });
    c = new InventoryController();
    c.open(engine);
    dispatch = vi.spyOn(engine.commandBus, 'dispatch');
  });

  const fillPack = (n: number) => {
    for (let i = 0; i < n; i++) player.inventory.primaryPack.addItem(ware(`w${i}`, `Ware ${String.fromCharCode(65 + i)}`));
  };

  describe('keys', () => {
    it('steps one cell with Left/Right and one row with Up/Down', () => {
      fillPack(7);
      c.gridColumns.backpack = 3;
      c.handleKeyDown(key('Tab'));
      expect(c.inspector.focusedPanel).toBe('backpack');
      c.handleKeyDown(key('ArrowRight'));
      expect(c.inspector.focusedIndex).toBe(1);
      c.handleKeyDown(key('ArrowDown'));
      expect(c.inspector.focusedIndex).toBe(4);
      c.handleKeyDown(key('ArrowDown'));
      // Below is a partial row: land on its last cell.
      expect(c.inspector.focusedIndex).toBe(6);
      c.handleKeyDown(key('ArrowUp'));
      expect(c.inspector.focusedIndex).toBe(3);
      c.handleKeyDown(key('ArrowUp'));
      c.handleKeyDown(key('ArrowUp'));
      // Up from the top row stays put.
      expect(c.inspector.focusedIndex).toBe(0);
      expect(c.inspector.selectedItem?.id).toBe('w0');
    });

    it('leaves Tab to the menu past the last panel and before the first', () => {
      expect(c.handleKeyDown(key('Tab', true))).toBe(false);
      for (const panel of ['backpack', 'ground', 'inspector']) {
        expect(c.handleKeyDown(key('Tab'))).toBe(true);
        expect(c.inspector.focusedPanel).toBe(panel);
      }
      expect(c.handleKeyDown(key('Tab'))).toBe(false);
    });

    it('backs out with Escape: the selection, then the container, then leaves it to the menu', () => {
      const chest = new Container({ id: 'chest', name: 'Chest', category: 'container', containerType: 'chest', weight: 1000, bulk: 500, maxWeightCapacity: 9000, maxBulkCapacity: 9000 });
      chest.addItem(ware('gem', 'Gem'));
      engine.map.addItemAt(5, 5, chest);
      c.pushContainer(chest, 'ground');
      c.selectCell('ground', 0);
      expect(c.inspector.selectedItem?.id).toBe('gem');
      expect(c.handleKeyDown(key('Escape'))).toBe(true);
      expect(c.inspector.selectedItem).toBeNull();
      expect(c.handleKeyDown(key('Escape'))).toBe(true);
      expect(c.activeContainer).toBeNull();
      expect(c.handleKeyDown(key('Escape'))).toBe(false);
    });

    it('opens a container with Enter and takes from it with T', () => {
      const chest = new Container({ id: 'chest', name: 'Chest', category: 'container', containerType: 'chest', weight: 1000, bulk: 500, maxWeightCapacity: 9000, maxBulkCapacity: 9000 });
      chest.addItem(ware('gem', 'Gem'));
      engine.map.addItemAt(5, 5, chest);
      c.handleKeyDown(key('Tab'));
      c.handleKeyDown(key('Tab'));
      c.handleKeyDown(key('Enter'));
      expect(c.activeContainer?.id).toBe('chest');
      expect(c.column3Source()).toBe('container');
      c.handleKeyDown(key('ArrowRight'));
      c.handleKeyDown(key('ArrowLeft'));
      c.handleKeyDown(key('KeyT'));
      expect(sent()).toContain('loot_container');
    });

    it('lets E and P fall through to the menu (they switch tabs) when there is nothing to act on', () => {
      expect(c.handleKeyDown(key('KeyE'))).toBe(false);
      expect(c.handleKeyDown(key('KeyP'))).toBe(false);
      expect(c.handleKeyDown(key('KeyD'))).toBe(false);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('equips the selected pack item with E and drops it with D', () => {
      fillPack(2);
      c.selectCell('backpack', 0);
      expect(c.handleKeyDown(key('KeyE'))).toBe(true);
      c.selectCell('backpack', 1);
      expect(c.handleKeyDown(key('KeyD'))).toBe(true);
      expect(sent()).toEqual(['equip_item', 'drop_item']);
    });

    it('marks the selected pack item as junk with J, and keeps it apart from its unmarked twin (2.5)', () => {
      player.inventory.primaryPack.addItem(ware('a', 'Old Boot', { identified: true }));
      player.inventory.primaryPack.addItem(ware('b', 'Old Boot', { identified: true }));
      expect(c.groups('backpack')).toHaveLength(1);
      expect(c.handleKeyDown(key('KeyJ'))).toBe(false); // nothing selected
      c.selectCell('backpack', 0);
      dispatch.mockRestore();
      expect(c.handleKeyDown(key('KeyJ'))).toBe(true);
      expect(player.inventory.primaryPack.getItem('a')!.junk).toBe(true);
      expect(c.groups('backpack')).toHaveLength(2);
    });

    it('keeps the focused cell selected after D or E, so the key works again on the next item', () => {
      // The soak bot pressed D a hundred times after one drop: the focus ring stayed on a
      // cell while the selection was cleared, and D needs a selection.
      fillPack(3);
      c.handleKeyDown(key('Tab'));
      c.handleKeyDown(key('ArrowRight'));
      expect(c.handleKeyDown(key('KeyD'))).toBe(true);
      expect(c.inspector.selectedItem?.id).toBe('w2');
      expect(c.handleKeyDown(key('KeyD'))).toBe(true);
      expect(sent()).toEqual(['drop_item', 'drop_item']);
      expect(player.inventory.primaryPack.getItems().map((i) => i.id)).toEqual(['w0']);
      // Off the end, the focus steps back onto the last cell.
      expect(c.inspector.focusedIndex).toBe(0);
      expect(c.inspector.selectedItem?.id).toBe('w0');
    });

    it('equips the numbered cell with a digit, counting cells as shown', () => {
      player.inventory.primaryPack.addItem(ware('a1', 'Apple'));
      player.inventory.primaryPack.addItem(ware('a2', 'Apple'));
      player.inventory.primaryPack.addItem(ware('b', 'Bread'));
      c.handleKeyDown(key('Digit2'));
      expect((dispatch.mock.calls[0][0] as unknown as { payload: { itemId: string } }).payload.itemId).toBe('b');
    });

    it('explains what Y needs when nothing can identify', () => {
      const log = vi.spyOn(engine, 'log');
      c.handleKeyDown(key('KeyY'));
      expect(log).toHaveBeenCalledWith(expect.stringMatching(/unidentified item/i));
    });

    it('cycles the sort with S through all six orders, and leaves O to the menu', () => {
      expect(c.handleKeyDown(key('KeyO'))).toBe(false);
      for (let i = 0; i < 6; i++) c.handleKeyDown(key('KeyS'));
      const modes = dispatch.mock.calls.map((call) => (call[0] as unknown as { payload: { mode: string } }).payload.mode);
      expect(modes).toEqual(['value', 'tier', 'weight', 'bulk', 'name', 'category']);
    });
  });

  describe('mouse', () => {
    it('drops by panel: equip on the paperdoll, drop on the ground, pick up into the pack', () => {
      fillPack(1);
      engine.map.addItemAt(5, 5, ware('rock', 'Rock'));
      c.startDrag({ panel: 'backpack', index: 0 });
      c.dropOn('paperdoll');
      c.startDrag({ panel: 'backpack', index: 0 });
      c.dropOn('ground');
      c.startDrag({ panel: 'ground', index: 0 });
      c.dropOn('backpack');
      expect(sent()).toEqual(['equip_item', 'drop_item', 'pickup_item']);
    });

    it('takes off a worn item dropped on the pack, and offers Unequip on right-click', () => {
      const sword = new Item({ id: 'sword', name: 'Sword', category: 'weapon', slot: 'mainHand', weight: 1000, bulk: 500 });
      player.inventory.paperdoll.equip(sword, 'mainHand');
      const slotIndex = player.inventory.paperdoll.getSlotDefinitions().findIndex((d) => d.id === 'mainHand');
      c.openContextMenu({ slotIndex }, 10, 10);
      expect(c.contextMenu?.options.map((o) => o.label)).toEqual(['Unequip', 'Inspect', 'Drop']);
      c.closeContextMenu();
      c.startDrag({ slotIndex });
      c.dropOn('backpack');
      expect(sent()).toEqual(['unequip_item']);
    });

    it('offers a potion its own actions on right-click, and splits a stack', () => {
      const potion = new PotionItem({ id: 'pot', name: 'Healing Potion', weight: 100, bulk: 50, potionType: 'health', potency: 10 });
      potion.quantity = 4;
      player.inventory.primaryPack.addItem(potion);
      c.openContextMenu({ panel: 'backpack', index: 0 }, 10, 10);
      const labels = c.contextMenu?.options.map((o) => o.label) ?? [];
      expect(labels).toEqual(expect.arrayContaining(['Drink', 'Split stack…', 'Drop', 'Inspect']));
      expect(labels).not.toContain('Equip');
      c.runContextOption(labels.indexOf('Split stack…'));
      expect(c.splitDialog?.amount).toBe(2);
      c.handleKeyDown(key('ArrowRight'));
      c.handleKeyDown(key('ArrowRight'));
      expect(c.splitDialog?.amount).toBe(3);
      c.handleKeyDown(key('Enter'));
      expect(sent()).toEqual(['split_stack']);
      expect(c.splitDialog).toBeNull();
    });
  });

  describe('third column', () => {
    it("shows the companion's pack: K toggles it, T takes back, a drop gives", () => {
      engine.companion = new Companion({
        id: 'hound', name: 'Hound', position: { x: 5, y: 6 },
        stats: { hp: 30, maxHp: 30, attack: 6, defense: 2 }, speed: 100,
        companionDefinitionId: 'hound', packWeightCapacity: 10000, packBulkCapacity: 8000,
      });
      engine.companion.inventory.primaryPack.addItem(ware('bone', 'Bone'));
      fillPack(1);
      c.handleKeyDown(key('KeyK'));
      expect(c.column3Source()).toBe('companion');
      c.selectCell('ground', 0);
      expect(c.inspector.getAvailableActions(engine).map((a) => a.label)).toEqual(['Take back (T)']);
      c.handleKeyDown(key('KeyT'));
      c.startDrag({ panel: 'backpack', index: 0 });
      c.dropOn('ground');
      expect(sent()).toEqual(['transfer_from_companion', 'transfer_to_companion']);
      expect(c.handleKeyDown(key('Escape'))).toBe(true);
      expect(c.column3Source()).toBe('ground');
    });

    it('keeps a chest open beside the hero (a map double-click) and forgets it once out of reach', () => {
      const chest = new Container({ id: 'chest', name: 'Chest', category: 'container', containerType: 'chest', weight: 1000, bulk: 500, maxWeightCapacity: 9000, maxBulkCapacity: 9000 });
      engine.map.addItemAt(6, 5, chest);
      c.pushContainer(chest, 'ground');
      c.pruneContainers();
      expect(c.activeContainer?.id).toBe('chest');
      player.setPosition(2, 2);
      c.pruneContainers();
      expect(c.activeContainer).toBeNull();
    });

    it('pops to a breadcrumb', () => {
      const box = new Container({ id: 'box', name: 'Box', category: 'container', containerType: 'chest', weight: 1, bulk: 1, maxWeightCapacity: 9, maxBulkCapacity: 9 });
      const pouch = new Container({ id: 'pouch', name: 'Pouch', category: 'container', containerType: 'chest', weight: 1, bulk: 1, maxWeightCapacity: 9, maxBulkCapacity: 9 });
      c.pushContainer(box, 'ground');
      c.pushContainer(pouch, 'ground');
      c.popContainerTo(0);
      expect(c.activeContainer?.id).toBe('box');
      c.popContainerTo(-1);
      expect(c.containerNavStack).toHaveLength(0);
      expect(c.selectedGroundContainer).toBeNull();
    });
  });

  it('filters the pack by kind', () => {
    player.inventory.primaryPack.addItem(new Item({ id: 'sword', name: 'Sword', category: 'weapon', weight: 1000, bulk: 500 }));
    player.inventory.primaryPack.addItem(new PotionItem({ id: 'pot', name: 'Potion', weight: 100, bulk: 50, potionType: 'health', potency: 10 }));
    player.inventory.primaryPack.addItem(ware('ruby', 'Ruby', { value: 100 }));
    const ids = () => c.packItems().map((i) => i.id).sort();
    c.setFilter('gear');
    expect(ids()).toEqual(['sword']);
    c.setFilter('consumable');
    expect(ids()).toEqual(['pot']);
    c.setFilter('valuable');
    expect(ids()).toEqual(['ruby']);
  });
});

describe('cellLabel', () => {
  it('keeps the part of the name that tells items apart, with the stack count', () => {
    expect(cellLabel('Potion of Healing (3x)')).toEqual({ name: 'Healing', quantity: 3 });
    expect(cellLabel('Scroll of the Phase Door')).toEqual({ name: 'Phase Door', quantity: 1 });
    expect(cellLabel('Iron Sword')).toEqual({ name: 'Iron Sword', quantity: 1 });
  });
});
