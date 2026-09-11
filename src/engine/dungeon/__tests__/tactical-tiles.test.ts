import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameEngine } from '../../engine';
import { MovementAction } from '../../actions/movement';
import { CastSpellAction } from '../../actions/spell-actions';
import { calculateElementalDamage } from '../../magic/elements';
import { registerSpells, SPELL_REGISTRY } from '../../magic/spellRegistry';

describe('Tactical Surface Tiles & Terrain Physics', () => {
  let map: GameMap;
  let player: Player;
  let engine: GameEngine;

  beforeEach(() => {
    registerSpells([
      { id: 'lightning_bolt', name: 'Lightning Bolt', school: 'Combat', manaCost: 10, element: 'lightning', range: 12, basePower: 16, areaOfEffect: 0, reflects: true, targetType: 'ray', targetingMode: 'bounce_ray', description: '', effects: [{ type: 'damage', amount: 16, element: 'lightning' }] },
    ]);
    map = new GameMap(20, 20, TILES.FLOOR);
    player = new Player({
      id: 'test-hero',
      name: 'Freya',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
      strength: 15,
      mana: 50,
      maxMana: 50,
      speed: 100,
    });
    map.addEntity(player);
    engine = new GameEngine({ map, player });
  });

  afterEach(() => {
    for (const key of Object.keys(SPELL_REGISTRY)) delete SPELL_REGISTRY[key];
  });

  it('applies +50 movement action energy cost when stepping into ShallowWater', () => {
    map.setTile(5, 6, TILES.FLOOR);
    map.setTile(5, 7, TILES.SHALLOW_WATER);

    // Initial energy
    player.energy = 100;
    // Step onto normal floor (5, 6)
    const moveNormal = new MovementAction(player, 0, 1);
    const res1 = moveNormal.perform(engine);
    expect(res1.success).toBe(true);
    expect(res1.cost).toBe(100);

    // Step onto shallow water (5, 7)
    player.energy = 150;
    const moveWater = new MovementAction(player, 0, 1);
    const res2 = moveWater.perform(engine);
    expect(res2.success).toBe(true);
    expect(res2.cost).toBe(150); // BASE_ACTION_COST (100) + 50 = 150
  });

  it('imparts 50% Fire damage resistance and 200% Lightning vulnerability on ShallowWater', () => {
    // Normal floor
    const normalFire = calculateElementalDamage(20, 'fire', 'neutral');
    expect(normalFire.finalDamage).toBe(20);

    // Shallow water Fire resistance (50%)
    const waterFire = calculateElementalDamage(20, 'fire', 'neutral', undefined, 'shallow_water');
    expect(waterFire.finalDamage).toBe(10); // 50% damage

    // Normal floor Lightning
    const normalLightning = calculateElementalDamage(20, 'lightning', 'neutral');
    expect(normalLightning.finalDamage).toBe(20);

    // Shallow water Lightning vulnerability (200%)
    const waterLightning = calculateElementalDamage(20, 'lightning', 'neutral', undefined, 'shallow_water');
    expect(waterLightning.finalDamage).toBe(40); // 200% damage
  });

  it('passing an electric projectile across water triggers an area shock to adjacent entities in water', () => {
    // Layout:
    // (5, 5): Player caster
    // (5, 6), (5, 7), (5, 8): Shallow Water path
    // (6, 7): Monster standing in adjacent connected water!
    map.setTile(5, 6, TILES.SHALLOW_WATER);
    map.setTile(5, 7, TILES.SHALLOW_WATER);
    map.setTile(5, 8, TILES.SHALLOW_WATER);
    map.setTile(6, 7, TILES.SHALLOW_WATER);

    const monster = new Monster({
      id: 'water-goblin',
      name: 'Swamp Goblin',
      position: { x: 6, y: 7 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 0 },
      speed: 100,
      definitionId: 'goblin',
      aiType: 'melee',
      xpValue: 20,
      lootTable: [],
    });
    map.addEntity(monster);

    // Cast Lightning Bolt aimed down from (5, 5) to (5, 9)
    // The ray passes through (5, 6), (5, 7), (5, 8), which are shallow water.
    // The monster is at (6, 7) (not in direct ray path, but sharing connected water).
    const lightningSpell = SPELL_REGISTRY['lightning_bolt'];
    expect(lightningSpell).toBeDefined();

    const castAction = new CastSpellAction(player, 'lightning_bolt', 5, 9);
    const res = castAction.perform(engine);
    expect(res.success).toBe(true);

    // Monster was shocked via water conductivity!
    expect(monster.hp).toBeLessThan(30);
    const messages = engine.messages.filter((m) => m.includes('Lightning conducts through the shallow water'));
    expect(messages.length).toBeGreaterThan(0);
  });
});
