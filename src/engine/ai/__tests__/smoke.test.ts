import { describe, expect, it } from 'vitest';
import { GameEngine } from '../../engine';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { DrinkPotionAction } from '../../actions/spell-actions';
import { PotionItem } from '../../items/consumables';

/** An open 30×12 hall; the hero on the west side, a hunter 3 tiles east that has seen the hero. */
function hall() {
  const map = new GameMap(30, 12, TILES.WALL);
  for (let y = 1; y < 11; y++) for (let x = 1; x < 29; x++) map.setTile(x, y, TILES.FLOOR);
  const player = new Player({ id: 'hero', position: { x: 6, y: 5 }, stats: { hp: 500, maxHp: 500, attack: 1, defense: 50 } });
  const engine = new GameEngine({ map, player });
  const hunter = new Monster({
    id: 'hunter',
    name: 'Hunter',
    position: { x: 9, y: 5 },
    stats: { hp: 40, maxHp: 40, attack: 1, defense: 0 },
    aiType: 'melee',
    aiState: 'hunting',
    xpValue: 1,
    lootTable: [],
  });
  engine.addEntity(hunter);
  return { engine, player, hunter };
}

const chebyshev = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

describe('smoke and blindness', () => {
  it('a blinded monster loses the hero who steps away, and searches where it last saw them', () => {
    const { engine, player, hunter } = hall();
    hunter.takeTurn(engine); // sees the hero
    hunter.statusManager.applyStatus({ type: 'blindness', duration: 6 }, [], hunter, engine);
    engine.map.moveEntity(player, 6, 9);

    let nearest = Infinity;
    for (let t = 0; t < 5; t++) {
      hunter.takeTurn(engine);
      nearest = Math.min(nearest, chebyshev(hunter, player));
    }

    expect(nearest).toBeGreaterThan(1);
    expect(hunter.intent.type).toBe('searching');
  });

  it('a hero standing in dense smoke is hidden from a monster beyond arm\'s reach', () => {
    const { engine, player, hunter } = hall();
    hunter.takeTurn(engine); // sees the hero at (6, 5)
    engine.map.moveEntity(player, 14, 9);
    engine.surfaces.setGas(14, 9, 'dense_steam', 10);

    for (let t = 0; t < 3; t++) hunter.takeTurn(engine);

    // It went back toward (6, 5), where it last saw the hero, not toward the smoke.
    expect(hunter.x).toBeLessThan(9);
  });

  it('the Bellows-Skin effect fills the air around the drinker with smoke', () => {
    const { engine, player } = hall();
    const canteen = new PotionItem({
      id: 'canteen-test',
      name: 'Canteen',
      effects: [{ type: 'release_gas', gas: 'dense_steam', radius: 2, duration: 5 }],
    });
    player.addItem(canteen);

    expect(new DrinkPotionAction(player, canteen).perform(engine).success).toBe(true);

    expect(engine.surfaces.getCell(player.x, player.y)?.gas?.type).toBe('dense_steam');
    expect(engine.surfaces.getCell(player.x + 2, player.y)?.gas?.type).toBe('dense_steam');
    expect(engine.surfaces.getCell(player.x + 3, player.y)?.gas).toBeUndefined();
  });
});
