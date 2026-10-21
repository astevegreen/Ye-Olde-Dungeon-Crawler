import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../../engine/engine';
import { GameMap } from '../../../engine/grid/map';
import { TILES } from '../../../engine/grid/tile';
import { Player } from '../../../engine/entities/player';
import { Monster } from '../../../engine/entities/monster';
import { Item } from '../../../engine/items/item';
import { familyModifier } from '../../../engine/items/modifierRoller';
import { CastSpellAction } from '../../../engine/actions/spell-actions';
import type { EquipmentSlot, ItemCategory } from '../../../engine/items/item';
import { COTW_ITEM_FAMILIES } from '../itemFamilies';
import { COTW_SPELLS } from '../spells';
import { cotwManifest } from '../index';

// Sprint B9 (#46): one town-start soak seed (17 Oct) cast Magic Arrow for no Seiðr: the hero
// wore Enchanted, Arcane and Archmage's gear, whose flat discounts (2 + 4 + 6) outweigh its
// cost. Since 5fe6181d a spell that costs mana costs at least 1; this proves it on the cast.

describe('B9 · Magic Arrow under stacked flat discounts still costs Seiðr', () => {
  it('a hero wearing Enchanted, Arcane and Archmage’s gear spends the turn and exactly 1 Seiðr', () => {
    const arrow = COTW_SPELLS.find((s) => s.id === 'magic_arrow')!;
    const map = new GameMap(15, 7, TILES.FLOOR);
    const hero = new Player({
      id: 'hero', name: 'Hero', position: { x: 2, y: 3 }, stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
      mana: 30, maxMana: 30, spellsKnown: ['magic_arrow'],
    });
    map.addEntity(hero);
    const engine = new GameEngine({ map, player: hero, seed: 7, manifest: cotwManifest });
    const target = new Monster({ id: 'dummy', name: 'Dummy', position: { x: 7, y: 3 }, stats: { hp: 500, maxHp: 500, attack: 0, defense: 0 } });
    engine.addEntity(target);

    // The cotw Enchanted family's three tiers: found on floors 1, 10 and 25.
    const worn: [EquipmentSlot, ItemCategory, number][] = [['mainHand', 'weapon', 1], ['fingerLeft', 'ring', 10], ['neck', 'amulet', 25]];
    const discounts: number[] = [];
    for (const [slot, category, floor] of worn) {
      const item = new Item({ id: `gear-${slot}`, name: 'Gear', category, slot, weight: 100, bulk: 100, identified: true });
      const modifier = familyModifier(COTW_ITEM_FAMILIES, 'enchanted', floor, 'test')!;
      item.addModifier(modifier);
      discounts.push(modifier.manaCostDiscount ?? 0);
      expect(hero.inventory.paperdoll.equip(item, slot).success).toBe(true);
    }
    expect(discounts).toEqual([2, 4, 6]);
    expect(2 + 4 + 6).toBeGreaterThanOrEqual(arrow.manaCost);

    hero.energy = 100;
    const before = hero.mana;
    const result = engine.handlePlayerAction(new CastSpellAction(hero, 'magic_arrow', target.x, target.y));

    expect(result.success).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    expect(before - hero.mana).toBe(1);
  });
});
