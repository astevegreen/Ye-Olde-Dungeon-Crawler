import { describe, it, expect } from 'vitest';
import { GameEngine } from '../engine';
import { GameMap } from '../grid/map';
import { TILES } from '../grid/tile';
import { Player } from '../entities/player';
import { Monster } from '../entities/monster';
import { CastSpellAction } from '../actions/spell-actions';
import { registerSpell } from '../magic/spellRegistry';
import type { SpellDefinition } from '../magic/types';
import { parseAndRollDice } from '../magic/spellPipeline';

describe('Composable Spell Pipeline & Effect Primitives', () => {
  function createTestEngine() {
    const map = new GameMap(20, 20, TILES.FLOOR);
    const player = new Player({
      id: 'p-test',
      name: 'Archmage',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
    });
    player.mana = 100;
    player.maxMana = 100;

    const engine = new GameEngine({ map, player });
    return { engine, map, player };
  }

  it('correctly parses and evaluates dice notations and fixed numbers', () => {
    expect(parseAndRollDice(25)).toBe(25);
    expect(parseAndRollDice('30')).toBe(30);

    // Roll 100 iterations of 2d6+4 to verify range [6, 16]
    for (let i = 0; i < 50; i++) {
      const rolled = parseAndRollDice('2d6+4');
      expect(rolled).toBeGreaterThanOrEqual(6);
      expect(rolled).toBeLessThanOrEqual(16);
    }
  });

  it('executes composable damage effect with elemental affinity', () => {
    const { engine, map, player } = createTestEngine();

    const frostling = new Monster({
      id: 'm-frost',
      name: 'Frostling',
      position: { x: 7, y: 5 },
      stats: { hp: 40, maxHp: 40, attack: 5, defense: 0 },
    });
    frostling.elementalResistances = { fire: 'weak' };
    map.addEntity(frostling);

    const customPyro: SpellDefinition = {
      id: 'pyro_blast',
      name: 'Pyro Blast',
      school: 'Combat',
      manaCost: 10,
      element: 'fire',
      range: 8,
      basePower: 0,
      areaOfEffect: 0,
      reflects: false,
      targetType: 'ray',
      targetingMode: 'ray',
      description: 'A focused burst of flame.',
      effects: [{ type: 'damage', amount: 20, element: 'fire' }],
    };
    registerSpell(customPyro);

    const action = new CastSpellAction(player, 'pyro_blast', 7, 5);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    // Frostling is weak to fire: 20 * 1.5 = 30 damage. Remaining HP: 40 - 30 = 10.
    expect(frostling.hp).toBe(10);
  });

  it('executes chain effect with hop distance tracking and damage decay', () => {
    const { engine, map, player } = createTestEngine();

    // Spawn 3 goblins lined up: (7, 5), (9, 5), (11, 5)
    const gob1 = new Monster({
      id: 'gob-1',
      name: 'Goblin Alpha',
      position: { x: 7, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 4, defense: 0 },
    });
    const gob2 = new Monster({
      id: 'gob-2',
      name: 'Goblin Beta',
      position: { x: 9, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 4, defense: 0 },
    });
    const gob3 = new Monster({
      id: 'gob-3',
      name: 'Goblin Gamma',
      position: { x: 11, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 4, defense: 0 },
    });
    map.addEntity(gob1);
    map.addEntity(gob2);
    map.addEntity(gob3);

    const chainLightning: SpellDefinition = {
      id: 'chain_lightning',
      name: 'Chain Lightning',
      school: 'Combat',
      manaCost: 15,
      element: 'lightning',
      range: 8,
      basePower: 0,
      areaOfEffect: 0,
      reflects: false,
      targetType: 'ray',
      targetingMode: 'ray',
      description: 'Arcs between multiple nearby targets.',
      effects: [
        { type: 'damage', amount: 30, element: 'lightning' },
        { type: 'chain', maxHops: 2, hopRange: 4, damageDecay: 0.25 },
      ],
    };
    registerSpell(chainLightning);

    const action = new CastSpellAction(player, 'chain_lightning', 7, 5);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);

    // Initial target gob1 takes 30 damage -> hp: 20
    expect(gob1.hp).toBe(20);

    // Hop 1 to gob2 (dist = 2 <= 4): decay 25%, damage = 30 * 0.75 = 22 -> hp: 28
    expect(gob2.hp).toBe(28);

    // Hop 2 to gob3 (dist = 2 <= 4): decay 50%, damage = 30 * 0.50 = 15 -> hp: 35
    expect(gob3.hp).toBe(35);

    // Verify arc logs
    expect(engine.messages.some((m) => m.includes('arcs from Goblin Alpha to Goblin Beta'))).toBe(true);
    expect(engine.messages.some((m) => m.includes('arcs from Goblin Beta to Goblin Gamma'))).toBe(true);
  });

  it('applies status effect primitive correctly', () => {
    const { engine, map, player } = createTestEngine();

    const brute = new Monster({
      id: 'brute-1',
      name: 'Cave Brute',
      position: { x: 6, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 2 },
    });
    map.addEntity(brute);

    const cripplingCurse: SpellDefinition = {
      id: 'crippling_curse',
      name: 'Crippling Curse',
      school: 'Enchantment',
      manaCost: 8,
      element: 'arcane',
      range: 6,
      basePower: 0,
      areaOfEffect: 0,
      reflects: false,
      targetType: 'ray',
      targetingMode: 'ray',
      description: 'Cripples a foe with magical lethargy.',
      effects: [{ type: 'applyStatus', statusId: 'slow', duration: 5 }],
    };
    registerSpell(cripplingCurse);

    const action = new CastSpellAction(player, 'crippling_curse', 6, 5);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    expect(brute.statusManager.hasStatus('slow')).toBe(true);
    expect(brute.statusManager.getStatus('slow')?.duration).toBe(5);
  });

  it('executes teleport effect relocating entity within valid bounds', () => {
    const { engine, player } = createTestEngine();

    const originalPos = { x: player.x, y: player.y };
    const blinkSpell: SpellDefinition = {
      id: 'blink_step',
      name: 'Blink Step',
      school: 'Movement',
      manaCost: 5,
      element: 'arcane',
      range: 6,
      basePower: 0,
      areaOfEffect: 0,
      reflects: false,
      targetType: 'self',
      targetingMode: 'self',
      description: 'Instantly shifts space.',
      effects: [{ type: 'teleport', range: 6, random: true }],
    };
    registerSpell(blinkSpell);

    const action = new CastSpellAction(player, 'blink_step', player.x, player.y);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    const moved = player.x !== originalPos.x || player.y !== originalPos.y;
    expect(moved).toBe(true);
    expect(engine.map.isPassable(player.x, player.y)).toBe(true);
  });

  it('executes heal effect restoring caster health up to maxHp', () => {
    const { engine, player } = createTestEngine();

    player.hp = 15;
    const mendSpell: SpellDefinition = {
      id: 'divine_mend',
      name: 'Divine Mend',
      school: 'HealingDivination',
      manaCost: 6,
      element: 'healing',
      range: 0,
      basePower: 0,
      areaOfEffect: 0,
      reflects: false,
      targetType: 'self',
      targetingMode: 'self',
      description: 'Restores 25 health points.',
      effects: [{ type: 'heal', amount: 25 }],
    };
    registerSpell(mendSpell);

    const action = new CastSpellAction(player, 'divine_mend', player.x, player.y);
    const result = engine.handlePlayerAction(action);

    expect(result.success).toBe(true);
    expect(player.hp).toBe(40);
  });
});
