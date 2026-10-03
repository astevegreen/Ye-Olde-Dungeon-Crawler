import { describe, it, expect } from 'vitest';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { GameEngine } from '../../../engine/engine';
import { DrinkPotionAction } from '../../../engine/actions/spell-actions';
import { createScaledItem, type PotionItem } from '../../../engine';
import { cotwManifest } from '..';
import { BURNING_STATUS } from '../burning';

/**
 * Zealot's Sun-Flare once carried an onHit hook, which only equipped items fire: drunk,
 * it set nearby monsters "burning", a status CotW never defined, so it did nothing.
 */
const def = cotwManifest.items.find((d) => d.id === 'zealots_sun_flare')!;

const monster = (id: string, x: number, y: number) =>
  new Monster({ id, name: 'Draugr', position: { x, y }, stats: { hp: 100, maxHp: 100, attack: 5, defense: 0 }, speed: 100, definitionId: 'test_draugr', aiType: 'melee', xpValue: 1 });

describe("Zealot's Sun-Flare", () => {
  it('has no hooks: a potion is never equipped, so they could never fire', () => {
    expect(def.hooks).toBeUndefined();
  });

  it('sets every monster within 3 tiles burning, which scorches them each turn', () => {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({ id: 'hero', name: 'Hero', position: { x: 5, y: 5 }, stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 } });
    const near = monster('near', 7, 5);
    const far = monster('far', 15, 15);
    map.addEntity(player);
    map.addEntity(near);
    map.addEntity(far);
    const engine = new GameEngine({ map, player, manifest: cotwManifest });

    const flare = createScaledItem(def, 'flare-1', 20, () => 0.5) as PotionItem;
    player.inventory.primaryPack.addItem(flare);
    expect(new DrinkPotionAction(player, flare).perform(engine).success).toBe(true);

    expect(near.statusManager.hasStatus(BURNING_STATUS)).toBe(true);
    expect(far.statusManager.hasStatus(BURNING_STATUS)).toBe(false);

    for (let turn = 0; turn < 6; turn++) near.statusManager.tick(near, engine);
    // 6 a turn for 4 turns: the 25-point burst the hook described, spread over the burn.
    expect(near.hp).toBe(100 - 24);
    expect(near.statusManager.hasStatus(BURNING_STATUS)).toBe(false);
  });
});
