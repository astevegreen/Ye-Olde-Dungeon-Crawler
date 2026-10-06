import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { Player } from '../../entities/player';
import { TILES } from '../../grid/tile';
import { createScaledItem } from '../../dungeon/lootSpawner';
import { serializeItem, deserializeItem, itemDefinitionLookup } from '../../storage/serializer';
import { TrapInstance } from '../../dungeon/traps';
import type { GameContentManifest, ItemDefinition } from '../../types/manifest';
import type { Item } from '../item';

/**
 * What an item does while worn, beside its stats (`ItemDefinition.wornEffects`): a ring
 * that resists fire, a helm the hero can't be blinded through. Like hooks, it is the
 * definition's: never saved, given back on load, so old saves get it too.
 */
const RING: ItemDefinition = {
  id: 'test_fire_ring',
  name: 'Test Fire Ring',
  category: 'ring',
  slot: 'fingerLeft',
  weight: 40,
  bulk: 30,
  identified: true,
  wornEffects: { resistsElements: ['fire'], grantsStatusImmunities: ['blindness'] },
};
const BOOTS: ItemDefinition = {
  id: 'test_trap_boots',
  name: 'Test Trap Boots',
  category: 'boots',
  slot: 'feet',
  weight: 900,
  bulk: 900,
  identified: true,
  wornEffects: { trapImmune: true },
};

describe('what an item does while worn (ItemDefinition.wornEffects)', () => {
  let engine: GameEngine;
  let player: Player;
  let ring: Item;

  beforeEach(() => {
    const map = new GameMap(8, 8);
    map.fill(TILES.FLOOR);
    player = new Player({ position: { x: 3, y: 3 }, stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 } });
    map.addEntity(player);
    engine = new GameEngine({ map, player });
    ring = createScaledItem(RING, 'ring-1', 1, () => 0.5);
    player.inventory.storeItem(ring);
  });

  it('resists the element only while worn', () => {
    expect(player.affinityTo('fire')).toBe('neutral');
    expect(player.inventory.paperdoll.equip(ring).success).toBe(true);
    expect(player.affinityTo('fire')).toBe('resistant');
    player.inventory.paperdoll.unequip('fingerLeft');
    expect(player.affinityTo('fire')).toBe('neutral');
  });

  it('keeps a status off only while worn', () => {
    player.inventory.paperdoll.equip(ring);
    expect(player.statusManager.applyStatus({ type: 'blindness', duration: 3 }, player.statusImmunities, player, engine)).toBe(false);
    expect(player.isImmuneTo('blindness')).toBe(true);
    player.inventory.paperdoll.unequip('fingerLeft');
    expect(player.statusManager.applyStatus({ type: 'blindness', duration: 3 }, player.statusImmunities, player, engine)).toBe(true);
  });

  it('keeps a trap from springing under the bearer', () => {
    const boots = createScaledItem(BOOTS, 'boots-1', 1, () => 0.5);
    player.inventory.storeItem(boots);
    player.inventory.paperdoll.equip(boots);
    new TrapInstance({ id: 't1', type: 'pit', x: 3, y: 3, damage: 10 }).trigger(player, engine);
    expect(player.hp).toBe(50);
  });

  it('comes back from the definition on load, so it is never saved', () => {
    const node = serializeItem(ring);
    expect(JSON.stringify(node)).not.toContain('resistsElements');
    const lookup = itemDefinitionLookup({ items: [RING] } as unknown as GameContentManifest);
    const back = deserializeItem(node, lookup);
    expect(back.wornEffects).toEqual(RING.wornEffects);
  });
});
