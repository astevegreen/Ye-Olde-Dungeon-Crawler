import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../entities/player';
import { Monster } from '../../entities/monster';
import { GameMap } from '../../grid/map';
import { TILES } from '../../grid/tile';
import { GameEngine } from '../../engine';
import { CastSpellAction, DrinkPotionAction } from '../../actions/spell-actions';
import { SpellPipeline } from '../../magic/spellPipeline';
import { SpellRegistry } from '../../magic/spellRegistry';
import { COTW_BLOOD_SPELLS } from '../../../content/cotw/bloodMagic';
import { ItemFactory } from '../../items/factory';
import { TempleService } from '../../economy/services';
import { addCurrencyToPlayer } from '../../economy/currency';

describe('BloodMagicIntegration: EnergyModel, Casting, Corruption & Scaling', () => {
  let engine: GameEngine;
  let player: Player;
  let enemy: Monster;

  beforeEach(() => {
    SpellPipeline.ensureBuiltinEffects();
    for (const spell of COTW_BLOOD_SPELLS) {
      SpellRegistry.register(spell);
    }

    const map = new GameMap(15, 15, TILES.FLOOR);
    player = new Player({
      id: 'blood-mage',
      name: 'Blood Mage',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 10, defense: 5 },
      mana: 20,
      maxMana: 20,
    });
    // Unlock blood magic and initialize energy model with volatile energy
    player.initEnergyModel({
      structuredEnergy: 100,
      volatileEnergy: 50,
      maxVolatileEnergy: 100,
    });
    player.spellsKnown = ['blood_reap', 'blood_tap', 'crimson_ward', 'blood_spear', 'exsanguinate'];

    enemy = new Monster({
      id: 'target-dummy',
      name: 'Training Dummy',
      position: { x: 6, y: 5 },
      stats: { hp: 100, maxHp: 100, attack: 0, defense: 0 },
    });

    map.addEntity(player);
    map.addEntity(enemy);

    engine = new GameEngine({ map, player });
  });

  it('fails to cast Blood Reap if target is healthy (> 25% HP)', () => {
    enemy.hp = 100;
    const action = new CastSpellAction(player, 'blood_reap', 6, 5);
    const result = action.perform(engine);

    expect(result.success).toBe(false);
    expect(result.message).toContain('too healthy to reap');
  });

  it('casts Blood Reap on almost dead enemy, finishing them off to reap Volatile Energy', () => {
    player.hp = 30; // Damaged player
    enemy.hp = 15; // Almost dead (<= 25% of 100 max HP)
    player.energyModel!.volatileEnergy = 10;
    const initialCorruption = player.corruptionScore;

    const action = new CastSpellAction(player, 'blood_reap', 6, 5);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    // Monster is slain
    expect(enemy.isAlive()).toBe(false);
    // Player heals 5 HP
    expect(player.hp).toBe(35);
    // Slaying target reaps 25 volatile energy
    expect(player.energyModel!.volatileEnergy).toBe(35);
    // Adds 2 corruption
    expect(player.corruptionScore).toBe(initialCorruption + 2);
  });

  it('casts Blood Reap on near-death enemy who survives strike: deals damage but yields NO Volatile Energy', () => {
    enemy.hp = 25; // At 25% threshold, base damage 20 leaves 5 HP
    player.energyModel!.volatileEnergy = 10;
    const initialVolatile = player.energyModel!.volatileEnergy;

    const action = new CastSpellAction(player, 'blood_reap', 6, 5);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(enemy.hp).toBe(5);
    expect(enemy.isAlive()).toBe(true);
    // No volatile energy reaped because monster was not finished off (killed)
    expect(player.energyModel!.volatileEnergy).toBe(initialVolatile);
  });

  it('drinks Draught of Volatile Energy to completely refill the energy meter', () => {
    player.energyModel!.volatileEnergy = 12; // Depleted
    const draught = ItemFactory.createDraughtOfVolatileEnergy('draught-1');
    player.inventory.primaryPack.addItem(draught);

    const drinkAction = new DrinkPotionAction(player, draught);
    const result = drinkAction.perform(engine);

    expect(result.success).toBe(true);
    // Completely refilled to maxVolatileEnergy (100)
    expect(player.energyModel!.volatileEnergy).toBe(100);
  });

  it('burns Vitality Tender (Max HP) for emergency power when Volatile Energy is depleted if allowVitalityBurn is true', () => {
    player.energyModel!.volatileEnergy = 10; // Requires 20 for crimson_ward
    expect(player.maxHp).toBe(50);

    // Default cast fails and informs user they can burn Vitality Tender
    const actionFail = new CastSpellAction(player, 'crimson_ward', 5, 5);
    const resFail = actionFail.perform(engine);
    expect(resFail.success).toBe(false);
    expect(resFail.message).toContain('Not enough Volatile Energy');
    expect(resFail.message).toContain('burn Vitality Tender for emergency power');

    // Force cast with allowVitalityBurn = true
    const actionBurn = new CastSpellAction(player, 'crimson_ward', 5, 5, undefined, false, true);
    const resBurn = actionBurn.perform(engine);
    expect(resBurn.success).toBe(true);
    // Burned permanent max HP
    expect(player.maxHp).toBe(48); // 2 Max HP burned (deficit 10 / 5 = 2)
    expect(player.energyModel!.volatileEnergy).toBe(0);
    expect(player.statusManager.hasStatus('haste' as any)).toBe(true);
  });

  it('Temple of Thor scales donation cost and refuses services based on player corruption', () => {
    const cursedWeapon = ItemFactory.createCursedMace('cursed-1');
    player.inventory.paperdoll.equip(cursedWeapon, 'mainHand');

    // Give player enough gold (50,000 CP)
    addCurrencyToPlayer(player, 50000);

    // At low corruption (0) and neutral standing (0): standard cost 5,000 CP
    const resNormal = TempleService.cleanseCurses(player, undefined, undefined, engine);
    expect(resNormal.success).toBe(true);
    expect(resNormal.costInCp).toBe(5000);

    // Re-equip cursed item and set corruption to 30 (>= 25): doubles donation cost to 10,000 CP
    (cursedWeapon as any).quality = 'cursed';
    player.inventory.paperdoll.equip(cursedWeapon, 'mainHand');
    player.corruptionScore = 30;
    const resTainted = TempleService.cleanseCurses(player, undefined, undefined, engine);
    expect(resTainted.success).toBe(true);
    expect(resTainted.costInCp).toBe(10000);

    // At corruption >= 75: High Priest refuses services outright
    (cursedWeapon as any).quality = 'cursed';
    player.inventory.paperdoll.equip(cursedWeapon, 'mainHand');
    player.corruptionScore = 80;
    const resRefused = TempleService.cleanseCurses(player, undefined, undefined, engine);
    expect(resRefused.success).toBe(false);
    expect(resRefused.message).toContain('Desecrator of sacred altars');
  });

  it('casts Crimson Ward: consumes 20 Volatile Energy and applies haste/buff', () => {
    player.energyModel!.volatileEnergy = 30;
    const initialCorruption = player.corruptionScore;

    const action = new CastSpellAction(player, 'crimson_ward', 5, 5);
    const result = action.perform(engine);

    expect(result.success).toBe(true);
    expect(player.energyModel!.volatileEnergy).toBe(10);
    expect(player.corruptionScore).toBe(initialCorruption + 5);
    expect(player.statusManager.hasStatus('haste' as any)).toBe(true);
  });

  it('fails to cast Crimson Ward when Volatile Energy is insufficient', () => {
    player.energyModel!.volatileEnergy = 10; // Requires 20
    const action = new CastSpellAction(player, 'crimson_ward', 5, 5);
    const result = action.perform(engine);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Not enough Volatile Energy');
    expect(player.energyModel!.volatileEnergy).toBe(10);
  });

  it('casts Blood Spear and scales entropic shadow damage with rising corruption', () => {
    player.energyModel!.volatileEnergy = 50;

    // At 0 corruption: 1.0x multiplier
    player.corruptionScore = 0;
    const action1 = new CastSpellAction(player, 'blood_spear', 6, 5);
    action1.perform(engine);
    const damageAt0 = 100 - enemy.hp;

    // Reset dummy HP and boost corruption to 50: 1.5x multiplier (+50% entropic damage)
    enemy.hp = 100;
    player.energyModel!.volatileEnergy = 50;
    player.corruptionScore = 50;

    const action2 = new CastSpellAction(player, 'blood_spear', 6, 5);
    action2.perform(engine);
    const damageAt50 = 100 - enemy.hp;

    expect(damageAt50).toBeGreaterThan(damageAt0);
    expect(damageAt50).toBe(Math.round(damageAt0 * 1.5));
  });

  it('triggers progressive afflictions as corruption crosses 25, 50, and 75 thresholds', () => {
    expect(player.statusManager.hasStatus('tissue_necrosis' as any)).toBe(false);
    expect(player.statusManager.hasStatus('neural_decay' as any)).toBe(false);
    expect(player.statusManager.hasStatus('loss_of_divine_wards' as any)).toBe(false);

    // Cross 25: Tissue Necrosis reduces healing efficiency
    player.energyModel!.addCorruption(player, 30);
    expect(player.statusManager.hasStatus('tissue_necrosis' as any)).toBe(true);

    // Healing should be reduced by 25% (efficacy = 0.75)
    player.hp = 10;
    SpellPipeline.applyHealEffect(engine, player, player, { type: 'heal', amount: 20 });
    // 20 * 0.75 = 15 HP restored
    expect(player.hp).toBe(25);

    // Cross 50: Neural Decay
    player.energyModel!.addCorruption(player, 25); // Total 55
    expect(player.statusManager.hasStatus('neural_decay' as any)).toBe(true);

    // Cross 75: Loss of Divine Wards
    player.elementalResistances['holy' as any] = 'immune';
    player.energyModel!.addCorruption(player, 25); // Total 80
    expect(player.statusManager.hasStatus('loss_of_divine_wards' as any)).toBe(true);
    expect(player.elementalResistances['holy' as any]).toBeUndefined();
  });

  it('burns vitality tender to permanently reduce max HP in exchange for emergency power', () => {
    expect(player.maxHp).toBe(50);
    const burned = player.energyModel!.burnVitalityTender(player, 10);

    expect(burned).toBe(true);
    expect(player.maxHp).toBe(40);
    expect(player.energyModel!.vitalityTenderBurned).toBe(10);
    expect(player.corruptionScore).toBeGreaterThanOrEqual(10);
  });
});
