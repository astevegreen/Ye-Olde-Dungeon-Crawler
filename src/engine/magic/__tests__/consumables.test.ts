import { describe, it, expect } from 'vitest';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { Player } from '../../entities/player';
import { GameEngine } from '../../engine';
import { ItemFactory } from '../../items/factory';
import { ZapWandAction, ReadScrollAction, DrinkPotionAction } from '../../actions/spell-actions';
import { beforeEach, afterEach } from 'vitest';
import { registerSpells, SPELL_REGISTRY } from '../spellRegistry';

describe('Consumables Activation (Wands, Scrolls, Potions)', () => {
  beforeEach(() => {
    registerSpells([
      { id: 'lightning_bolt', name: 'Lightning Bolt', school: 'Combat', manaCost: 10, element: 'lightning', range: 12, basePower: 16, areaOfEffect: 0, reflects: true, targetType: 'ray', targetingMode: 'bounce_ray', description: '', effects: [{ type: 'damage', amount: 16, element: 'lightning' }] },
      { id: 'phase_door', name: 'Phase Door', school: 'Movement', manaCost: 5, element: 'arcane', range: 6, basePower: 0, areaOfEffect: 0, reflects: false, targetType: 'self', targetingMode: 'self', description: '', effects: [{ type: 'teleport', range: 6, random: true }] },
    ]);
  });
  afterEach(() => {
    for (const key of Object.keys(SPELL_REGISTRY)) delete SPELL_REGISTRY[key];
  });
  function setupTestWorld() {
    const map = new GameMap(12, 12, TILES.FLOOR);
    for (let x = 0; x < 12; x++) {
      map.setTile(x, 0, TILES.WALL);
      map.setTile(x, 11, TILES.WALL);
      map.setTile(0, x, TILES.WALL);
      map.setTile(11, x, TILES.WALL);
    }

    const player = new Player({
      id: 'hero',
      name: 'Odin',
      position: { x: 2, y: 2 },
      stats: { hp: 30, maxHp: 30, attack: 5, defense: 2 },
      mana: 10,
      maxMana: 30,
    });

    const engine = new GameEngine({ map, player });
    return { map, player, engine };
  }

  it('decrements wand charges on use and does NOT consume player mana', () => {
    const { player, engine } = setupTestWorld();
    const wand = ItemFactory.createWandOfLightning('wand-1', 3);
    player.inventory.primaryPack.addItem(wand);

    expect(wand.charges).toBe(3);
    expect(player.mana).toBe(10);

    const zapAction = new ZapWandAction(player, wand, 8, 2);
    const res1 = zapAction.perform(engine);

    expect(res1.success).toBe(true);
    expect(wand.charges).toBe(2);
    expect(player.mana).toBe(10); // Player mana preserved!

    // Zap until empty
    zapAction.perform(engine); // charges -> 1
    zapAction.perform(engine); // charges -> 0
    expect(wand.charges).toBe(0);

    // Attempting to zap empty wand must fail
    const resFailed = zapAction.perform(engine);
    expect(resFailed.success).toBe(false);
    expect(resFailed.message).toContain('depleted');
    expect(wand.charges).toBe(0);
  });

  it('consumes scroll upon reading and casts spell at zero mana cost', () => {
    const { player, engine } = setupTestWorld();
    const scroll = ItemFactory.createScrollOfTeleport('scroll-phase-1');
    player.inventory.primaryPack.addItem(scroll);

    expect(player.inventory.primaryPack.getItems()).toHaveLength(1);
    const initialMana = player.mana;

    const readAction = new ReadScrollAction(player, scroll);
    const result = readAction.perform(engine);

    expect(result.success).toBe(true);
    // Scroll was consumed from inventory
    expect(player.inventory.primaryPack.getItems()).toHaveLength(0);
    // No player mana consumed
    expect(player.mana).toBe(initialMana);
  });

  it('drinks health potion to heal and removes potion from pack', () => {
    const { player, engine } = setupTestWorld();
    player.hp = 10;
    const potion = ItemFactory.createHealthPotion('potion-hp-1');
    player.inventory.primaryPack.addItem(potion);

    const drinkAction = new DrinkPotionAction(player, potion);
    const result = drinkAction.perform(engine);

    expect(result.success).toBe(true);
    expect(player.hp).toBe(30); // 10 + 25 capped at maxHp 30
    expect(player.inventory.primaryPack.getItems()).toHaveLength(0);
  });

  it('drinks mana potion to restore mana and removes potion from pack', () => {
    const { player, engine } = setupTestWorld();
    player.mana = 5;
    const potion = ItemFactory.createManaPotion('potion-mp-1');
    player.inventory.primaryPack.addItem(potion);

    const drinkAction = new DrinkPotionAction(player, potion);
    const result = drinkAction.perform(engine);

    expect(result.success).toBe(true);
    expect(player.mana).toBe(25); // 5 + 20
    expect(player.inventory.primaryPack.getItems()).toHaveLength(0);
  });
});
