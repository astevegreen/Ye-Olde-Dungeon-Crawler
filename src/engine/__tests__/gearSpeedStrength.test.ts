import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { Player } from '../entities/player';
import { Item } from '../items/item';
import { EquipAction } from '../actions/inventory-actions';
import { EnergyScheduler } from '../scheduler';
import { calculateAttribute } from '../stats/attributeCalculator';
import { createScaledItem } from '../dungeon/lootSpawner';
import { familyModifier } from '../items/modifierRoller';
import { COTW_ITEM_FAMILIES } from '../../content/cotw/itemFamilies';
import { COTW_WEAPONS } from '../../content/cotw/items/weapons';

function setup(): { engine: GameEngine; player: Player } {
  const map = GameMap.createBoxRoom(20, 20);
  const player = new Player({
    id: 'player',
    name: 'Hero',
    position: { x: 5, y: 5 },
    stats: { hp: 100, maxHp: 100, attack: 10, defense: 0 },
    speed: 100,
    strength: 10,
  });
  player.gainEnergy(100);
  const engine = new GameEngine({ map, player });
  return { engine, player };
}

// The paperdoll summed these, but nothing read the sums: gear Speed and Strength did nothing.
describe('gear Speed and Strength reach the hero', () => {
  it('a worn Rime-Bit Chisel (+8 speed) makes the hero faster', () => {
    const { engine, player } = setup();
    const def = COTW_WEAPONS.find((d) => d.id === 'rime_bit_chisel')!;
    const chisel = createScaledItem(def, 'c1', 2, () => 0.5);
    player.inventory.primaryPack.addItem(chisel);
    expect(new EquipAction(player, 'c1').perform(engine).success).toBe(true);
    // The paperdoll sums it...
    expect(player.inventory.getEquipmentStats().speedBonus).toBe(8);

    // ...and the hero's speed and the energy the scheduler grants carry it.
    const scheduler = new EnergyScheduler();
    player.energy = 0;
    scheduler.addEntity(player);
    scheduler.advanceToNextActor(1);
    expect({
      speed: calculateAttribute(player, 'speed'),
      energyPerTick: player.energy,
    }).toEqual({ speed: 108, energyPerTick: 108 });
  });

  it('a worn Sanctified helmet (+2 strength) adds to Strength and carry Strength', () => {
    const { engine, player } = setup();
    const helm = new Item({ id: 'h1', name: 'Cap', category: 'helmet', slot: 'head', weight: 500, bulk: 400, identified: true });
    const sanctified = familyModifier(COTW_ITEM_FAMILIES, 'blessed', 10, 'test')!;
    expect(sanctified.statDeltas).toMatchObject({ strengthBonus: 2 });
    helm.addModifier(sanctified);
    player.inventory.primaryPack.addItem(helm);
    expect(new EquipAction(player, 'h1').perform(engine).success).toBe(true);
    expect(player.inventory.getEquipmentStats().strengthBonus).toBe(2);

    expect({
      strength: calculateAttribute(player, 'strength'),
      carryStrength: player.carryStrength,
    }).toEqual({ strength: 12, carryStrength: 12 });
  });

  it('a worn Blighted item (-10 speed) slows the hero', () => {
    const { engine, player } = setup();
    const ring = new Item({ id: 'r1', name: 'Iron Band', category: 'ring', slot: 'fingerLeft', weight: 50, bulk: 40, identified: true });
    const blighted = familyModifier(COTW_ITEM_FAMILIES, 'cursed', 20, 'test')!;
    expect(blighted.statDeltas).toMatchObject({ speedBonus: -10 });
    ring.addModifier(blighted);
    player.inventory.primaryPack.addItem(ring);
    expect(new EquipAction(player, 'r1').perform(engine).success).toBe(true);
    expect(player.inventory.getEquipmentStats().speedBonus).toBe(-10);

    const scheduler = new EnergyScheduler();
    player.energy = 0;
    scheduler.addEntity(player);
    scheduler.advanceToNextActor(1);
    expect({
      speed: calculateAttribute(player, 'speed'),
      energyPerTick: player.energy,
    }).toEqual({ speed: 90, energyPerTick: 90 });
  });
});
