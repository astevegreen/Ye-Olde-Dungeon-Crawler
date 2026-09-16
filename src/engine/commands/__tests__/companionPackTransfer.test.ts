import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Companion } from '../../entities/companion';
import { Item } from '../../items/item';

/**
 * Taking an item back from the companion's pack (ARCHITECTURE.md §3). Giving worked; the
 * return trip needed both a browsing UI and, in the command layer, for a companion-pack
 * item to count as reachable — it is carried by an ally standing beside you, not by you.
 */
function setup() {
  const map = new GameMap(12, 12, TILES.FLOOR);
  const player = new Player({ id: 'hero', name: 'Hero', position: { x: 3, y: 3 }, stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 } });
  const engine = new GameEngine({ map, player, seed: 21 });
  const companion = new Companion({
    id: 'hound-1',
    name: 'Hound',
    position: { x: 4, y: 3 },
    stats: { hp: 20, maxHp: 20, attack: 3, defense: 1 },
    speed: 100,
    definitionId: 'hound',
    companionDefinitionId: 'hound',
    aiType: 'melee',
    aiState: 'hunting',
    fleeHealthPercent: 0,
    xpValue: 0,
    lootTable: [],
    packWeightCapacity: 10_000,
    packBulkCapacity: 10_000,
  } as never);
  engine.addEntity(companion);
  (engine as unknown as { companion: Companion }).companion = companion;
  return { engine, player, companion };
}

const makeItem = (id: string) => new Item({ id, name: id, category: 'misc', weight: 100, bulk: 100 });

describe('Companion pack transfer', () => {
  it('resolves an item held in the companion pack as reachable', () => {
    const { engine, companion } = setup();
    const item = makeItem('relic-1');
    companion.inventory.primaryPack.addItem(item);

    const res = engine.commandBus.dispatch({ type: 'transfer_from_companion', payload: { itemId: 'relic-1' } });

    expect(res.success).toBe(true);
    expect(companion.inventory.primaryPack.getItems().map((i) => i.id)).not.toContain('relic-1');
    expect(engine.player.inventory.findItemById('relic-1')).toBeDefined();
  });

  it('refuses an item that is neither carried, underfoot, nor in the companion pack', () => {
    const { engine } = setup();
    const stranded = makeItem('far-away');
    engine.map.addItemAt(9, 9, stranded);

    const res = engine.commandBus.dispatch({ type: 'transfer_from_companion', payload: { itemId: 'far-away' } });

    expect(res.success).toBe(false);
  });

  it('round-trips an item given and then taken back', () => {
    const { engine, player, companion } = setup();
    const item = makeItem('torch-1');
    player.inventory.primaryPack.addItem(item);

    engine.commandBus.dispatch({ type: 'transfer_to_companion', payload: { itemId: 'torch-1' } });
    expect(companion.inventory.primaryPack.getItems().map((i) => i.id)).toContain('torch-1');

    engine.commandBus.dispatch({ type: 'transfer_from_companion', payload: { itemId: 'torch-1' } });
    expect(player.inventory.findItemById('torch-1')).toBeDefined();
  });
});
