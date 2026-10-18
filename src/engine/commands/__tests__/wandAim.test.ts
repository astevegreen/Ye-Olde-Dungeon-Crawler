import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { ItemFactory } from '../../items/factory';
import { useTestSpells } from '../../__fixtures__/testHelpers';
import { COTW_SPELLS } from '../../../content/cotw/spells';

function setup() {
  const map = new GameMap(12, 12, TILES.FLOOR);
  for (let i = 0; i < 12; i++) {
    map.setTile(i, 0, TILES.WALL);
    map.setTile(i, 11, TILES.WALL);
    map.setTile(0, i, TILES.WALL);
    map.setTile(11, i, TILES.WALL);
  }
  const player = new Player({
    id: 'hero',
    name: 'Odin',
    position: { x: 5, y: 5 },
    stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 },
    mana: 10,
    maxMana: 30,
  });
  const engine = new GameEngine({ map, player, seed: 1234 });
  const wand = ItemFactory.createWandOfFireballs('wand-fb-1', 5);
  player.inventory.primaryPack.addItem(wand);
  return { engine, player, wand };
}

// The inventory's Zap once sent only an itemId, and the bus aimed the wand at the hero's own tile.
describe('zap_wand without a target', () => {
  useTestSpells(COTW_SPELLS.filter((s) => s.id === 'fireball'));

  it('refuses an aimed wand: no blast on the hero, no charge, no turn', () => {
    const { engine, player, wand } = setup();
    const turn = engine.turnCount;

    const res = engine.commandBus.dispatch({ type: 'zap_wand', payload: { itemId: wand.id } });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Choose a target/);
    expect(player.hp).toBe(100);
    expect(wand.charges).toBe(5);
    expect(engine.turnCount).toBe(turn);
  });

  it('fires where it is aimed', () => {
    const { engine, player, wand } = setup();

    const res = engine.commandBus.dispatch({ type: 'zap_wand', payload: { itemId: wand.id, targetX: 9, targetY: 9 } });

    expect(res.success).toBe(true);
    expect(wand.charges).toBe(4);
    expect(player.hp).toBe(100);
  });
});
