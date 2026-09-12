import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import {
  createTestOgre,
  createTestGiantRat,
  createTestKobold,
} from '../../__fixtures__/testHelpers';
import { GameEngine } from '../../engine';
import { DeathResolver } from '../deathResolver';
import { MeleeAttackAction } from '../../actions/combat';
import { CastSpellAction } from '../../actions/spell-actions';
import { beforeEach, afterEach } from 'vitest';
import { registerSpells, SPELL_REGISTRY } from '../../magic/spellRegistry';

describe('Death Resolution, XP & Loot Drops', () => {
  beforeEach(() => {
    registerSpells([
      { id: 'firebolt', name: 'Firebolt', school: 'Combat', manaCost: 5, element: 'fire', range: 7, basePower: 12, areaOfEffect: 0, reflects: false, targetType: 'ray', targetingMode: 'ray', description: '', effects: [{ type: 'damage', amount: 12, element: 'fire' }] },
    ]);
  });
  afterEach(() => {
    for (const key of Object.keys(SPELL_REGISTRY)) delete SPELL_REGISTRY[key];
  });
  it('awards XP upon monster defeat and triggers player level up with stat buffs', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({
      position: { x: 2, y: 2 },
      stats: { hp: 30, maxHp: 30, attack: 10, defense: 2 },
      strength: 15,
      mana: 30,
      maxMana: 30,
    });
    const engine = new GameEngine({ map, player });

    expect(player.level).toBe(1);
    expect(player.xp).toBe(0);
    expect(player.xpToNextLevel).toBe(50);

    // Create an Ogre with 120 XP value
    const ogre = createTestOgre('ogre-1', { x: 3, y: 2 });
    engine.addEntity(ogre);

    // Resolve ogre death by player
    DeathResolver.resolveDeath(engine, player, ogre);

    // 120 XP awarded:
    // Level 1 -> Level 2 requires 50 XP (remains 70 XP)
    // Level 2 -> Level 3 requires 50*2 + 25 = 125 XP
    expect(player.level).toBe(2);
    expect(player.xp).toBe(70);
    expect(player.maxHp).toBe(35); // +5
    expect(player.maxMana).toBe(34); // +4
    expect(player.unspentStatPoints).toBe(3); // 3 unspent stat points per level
    expect(player.strength).toBe(15); // base untouched until allocated
    player.allocateAttribute('strength', 1);
    expect(player.strength).toBe(16);
    expect(player.unspentStatPoints).toBe(2);
    expect(ogre.isAlive()).toBe(false);
    expect(engine.map.getEntityById('ogre-1')).toBeNull();
  });

  it('generates ground loot on the monster death tile', () => {
    const map = new GameMap(10, 10, TILES.FLOOR);
    const player = new Player({ position: { x: 2, y: 2 } });
    const engine = new GameEngine({ map, player });

    const deathPos = { x: 4, y: 4 };
    const ogre = createTestOgre('ogre-loot', deathPos);
    engine.addEntity(ogre);

    expect(engine.map.getItemsAt(deathPos.x, deathPos.y)).toHaveLength(0);

    DeathResolver.resolveDeath(engine, player, ogre);

    // Ogre guarantees gold coins (100% chance rule) plus potential equipment
    const droppedItems = engine.map.getItemsAt(deathPos.x, deathPos.y);
    expect(droppedItems.length).toBeGreaterThanOrEqual(1);
    expect(droppedItems.some((i) => i.name.toLowerCase().includes('gold'))).toBe(true);
  });

  it('resolves death and loot through MeleeAttackAction', () => {
    const map = new GameMap(8, 8, TILES.FLOOR);
    const player = new Player({
      position: { x: 1, y: 1 },
      stats: { hp: 30, maxHp: 30, attack: 30, defense: 5 },
    });
    const rat = createTestGiantRat('rat-1', { x: 2, y: 1 });
    const engine = new GameEngine({ map, player });
    engine.addEntity(rat);

    const attack = new MeleeAttackAction(player, rat);
    const res = attack.perform(engine);

    expect(res.success).toBe(true);
    expect(rat.isAlive()).toBe(false);
    expect(player.xp).toBe(10); // Giant rat grants 10 XP
  });

  it('resolves death and loot through CastSpellAction', () => {
    const map = new GameMap(8, 8, TILES.FLOOR);
    const player = new Player({
      position: { x: 1, y: 1 },
      mana: 30,
      maxMana: 30,
    });
    const kobold = createTestKobold('kob-1', { x: 4, y: 1 });
    // Lower kobold hp so single firebolt destroys it
    kobold.hp = 5;

    const engine = new GameEngine({ map, player });
    engine.addEntity(kobold);

    const spellAction = new CastSpellAction(player, 'firebolt', 4, 1);
    const res = spellAction.perform(engine);

    expect(res.success).toBe(true);
    expect(kobold.isAlive()).toBe(false);
    expect(player.xp).toBe(15); // Kobold grants 15 XP
  });
});
