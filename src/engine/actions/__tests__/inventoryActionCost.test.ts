import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Item } from '../../items/item';
import { PickUpAction, EquipAction, DropAction } from '../inventory-actions';
import { COTW_MILESTONE_PERKS } from '../../../content/cotw/perks';
import type { GameContentManifest } from '../../types/manifest';

/**
 * Inventory actions (pick up, drop, equip, ...) charged energy from raw Strength, while every
 * other player action goes through `player.getActionCost` (carry Strength, then slow and haste).
 */
function build() {
  const map = new GameMap(20, 20, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 }, strength: 10 });
  map.addEntity(player);
  const manifest = { id: 'test', name: 'Test', monsters: [], items: [], spells: [] } as unknown as GameContentManifest;
  const engine = new GameEngine({ map, player, manifest });
  player.gainEnergy(1000);
  return { engine, player, map };
}

const oxShoulders = COTW_MILESTONE_PERKS.find((p) => p.id === 'milestone_ox_shoulders')!;

describe('inventory actions cost what any action costs: carry Strength, haste, slow', () => {
  it('an Ox-Shoulders hero, Unencumbered at carry Strength 15, picks up at the same cost as a move', () => {
    const { engine, player, map } = build();
    player.grantPerk(oxShoulders);
    expect(player.carryStrength).toBe(15);
    // 15 kg in the pack: 0.6 of Strength 10's 25 kg (Burdened), 0.4 of carry Strength 15's 37.5 kg.
    player.inventory.primaryPack.addItem(new Item({ id: 'anvil', name: 'Anvil', category: 'misc', weight: 15000, bulk: 1, identified: true }));
    map.addItemAt(5, 5, new Item({ id: 'pebble', name: 'Pebble', category: 'misc', weight: 1, bulk: 1, identified: true }));
    expect(player.inventory.primaryPack.getItem('anvil')).toBeTruthy();

    const result = new PickUpAction(player, 'pebble').perform(engine);
    expect(result.success).toBe(true);
    expect(player.getActionCost(100)).toBe(100);
    expect(result.cost).toBe(player.getActionCost(100));
  });

  it('a hasted hero equips a sword for 75 energy, like any other hasted action', () => {
    const { engine, player } = build();
    player.statusManager.applyStatus({ type: 'haste', duration: 5 }, [], player, engine);
    expect(player.statusManager.hasStatus('haste')).toBe(true);
    player.inventory.primaryPack.addItem(new Item({ id: 'sword', name: 'Sword', category: 'weapon', slot: 'mainHand', weight: 1000, bulk: 1, identified: true }));

    const result = new EquipAction(player, 'sword', 'mainHand').perform(engine);
    expect(result.success).toBe(true);
    expect(player.getActionCost(100)).toBe(75);
    expect(result.cost).toBe(75);
  });

  it('a slowed hero drops an item for 150 energy, like any other slowed action', () => {
    const { engine, player } = build();
    player.statusManager.applyStatus({ type: 'slow', duration: 5 }, [], player, engine);
    expect(player.statusManager.hasStatus('slow')).toBe(true);
    const rock = new Item({ id: 'rock', name: 'Rock', category: 'misc', weight: 100, bulk: 1, identified: true });
    player.inventory.primaryPack.addItem(rock);

    const result = new DropAction(player, rock).perform(engine);
    expect(result.success).toBe(true);
    expect(player.getActionCost(100)).toBe(150);
    expect(result.cost).toBe(150);
  });
});
