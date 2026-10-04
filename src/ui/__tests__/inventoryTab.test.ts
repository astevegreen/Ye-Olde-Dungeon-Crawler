import { describe, it, expect, beforeEach } from 'vitest';
import { InventoryTab } from '../inventory/inventoryTab';
import { GameEngine, GameMap, Item, Player } from '../../engine';
import type { GameState } from '../characterMenu/gameState';

// Under node the tab renders into a stand-in element whose innerHTML is the markup;
// querySelector finds nothing, so only the markup is checked here.
class MockElement {
  public innerHTML = '';
  querySelector(): null {
    return null;
  }
}

describe('InventoryTab', () => {
  let engine: GameEngine;
  let player: Player;
  let tab: InventoryTab;
  let el: MockElement;

  const state = (): GameState =>
    ({ engine, worldState: engine.worldState, player: engine.player, map: engine.map }) as unknown as GameState;

  beforeEach(() => {
    player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 } });
    engine = new GameEngine({ map: GameMap.createBoxRoom(10, 10), player });
    player.inventory.paperdoll.equip(new Item({ id: 'helm', name: 'Iron Helm', category: 'helmet', slot: 'head', weight: 1500, bulk: 400 }), 'head');
    player.inventory.primaryPack.addItem(new Item({ id: 'rope', name: 'Coil of Rope', category: 'misc', weight: 2500, bulk: 900 }));
    tab = new InventoryTab();
    el = new MockElement();
    tab.mount(el as unknown as HTMLElement);
    tab.onActivate(state());
  });

  it('names every paperdoll slot in full, weighs in kg, and shows no stats strip', () => {
    const html = el.innerHTML;
    for (const def of player.inventory.paperdoll.getSlotDefinitions()) {
      expect(html).toContain(`<span class="inv-slot-name">${def.name}</span>`);
    }
    expect(html).not.toMatch(/>(HD|CK|NK|BLT|PRS)</);
    expect(html).toMatch(/\d+(\.\d+)? \/ \d+(\.\d+)? kg/);
    expect(html).not.toMatch(/\bSTR:|\bATK:|\bDEF:/);
    expect(html).toContain('Coil of Rope');
  });

  it('shows the +N badge on a worn item only once it is identified', () => {
    player.inventory.paperdoll.equip(
      new Item({ id: 'ring', name: 'Band', category: 'ring', slot: 'fingerLeft', weight: 20, bulk: 10, enchantmentLevel: 3, identified: false }),
      'fingerLeft'
    );
    tab.onActivate(state());
    expect(el.innerHTML).not.toContain('inv-plus');
    player.inventory.paperdoll.getItem('fingerLeft')!.identified = true;
    tab.onActivate(state());
    expect(el.innerHTML).toContain('>+3</span>');
  });

  it('shows the selected item beside the lists, and says Esc backs out of it', () => {
    expect(tab.footer().escLabel).toBe('close');
    tab.controller.selectCell('backpack', 0);
    expect(el.innerHTML).toContain('inv-detail-name');
    expect(el.innerHTML).toContain('2.5 kg');
    expect(tab.footer().escLabel).toBe('back');
  });

  it('claims Tab for its panels and enters on the last one from Shift+Tab', () => {
    expect(tab.claimsTabKey).toBe(true);
    tab.onActivate(state(), 'backward');
    expect(tab.controller.inspector.focusedPanel).toBe('inspector');
  });
});
