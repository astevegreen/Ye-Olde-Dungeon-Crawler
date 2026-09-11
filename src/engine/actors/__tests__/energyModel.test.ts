import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../../entities/player';
import {
  EnergyModel,
} from '../energyModel';

describe('EnergyModel: Dual-Energy, Corruption & Vitality Tender', () => {
  let player: Player;
  let energyModel: EnergyModel;

  beforeEach(() => {
    player = new Player({
      id: 'hero',
      name: 'Hero',
      position: { x: 5, y: 5 },
      stats: { hp: 50, maxHp: 50, attack: 5, defense: 2 },
    });
    energyModel = new EnergyModel({
      structuredEnergy: 100,
      maxStructuredEnergy: 100,
      volatileEnergy: 50,
      maxVolatileEnergy: 50,
    });
  });

  it('handles structured energy consumption and regeneration', () => {
    expect(energyModel.consumeStructuredEnergy(40)).toBe(true);
    expect(energyModel.structuredEnergy).toBe(60);

    // Overspending fails
    expect(energyModel.consumeStructuredEnergy(80)).toBe(false);
    expect(energyModel.structuredEnergy).toBe(60);

    // Regenerate
    const gained = energyModel.regenerateStructuredEnergy(25);
    expect(gained).toBe(25);
    expect(energyModel.structuredEnergy).toBe(85);
  });

  it('consumes volatile energy and increments corruption score', () => {
    expect(player.corruptionScore).toBe(0);

    const res = energyModel.consumeVolatileEnergy(player, 20);
    expect(res.success).toBe(true);
    expect(res.corruptionAdded).toBe(20);
    expect(energyModel.volatileEnergy).toBe(30);
    expect(player.corruptionScore).toBe(20);
  });

  it('burns vitality tender reducing max HP and adding corruption', () => {
    expect(player.maxHp).toBe(50);
    expect(player.hp).toBe(50);

    const burned = energyModel.burnVitalityTender(player, 10);
    expect(burned).toBe(true);
    expect(player.maxHp).toBe(40);
    expect(player.hp).toBe(40);
    expect(energyModel.vitalityTenderBurned).toBe(10);
    expect(player.corruptionScore).toBe(10);
  });

  it('triggers tiered corruption threshold afflictions sequentially', () => {
    player.elementalResistances = { holy: 'immune' } as any;

    // Below 25: no afflictions
    energyModel.addCorruption(player, 20);
    expect(player.corruptionScore).toBe(20);
    expect(player.statusManager.hasStatus('tissue_necrosis' as any)).toBe(false);

    // Cross 25: Tier 1 Tissue Necrosis
    const aff1 = energyModel.addCorruption(player, 10); // total 30
    expect(aff1).toContain('tissue_necrosis');
    expect(player.statusManager.hasStatus('tissue_necrosis' as any)).toBe(true);
    expect(EnergyModel.calculateHealingEfficiency(player)).toBe(0.75);

    // Cross 50: Tier 2 Neural Decay
    const aff2 = energyModel.addCorruption(player, 25); // total 55
    expect(aff2).toContain('neural_decay');
    expect(player.statusManager.hasStatus('neural_decay' as any)).toBe(true);

    // Cross 75: Tier 3 Loss of Divine Wards
    const aff3 = energyModel.addCorruption(player, 25); // total 80
    expect(aff3).toContain('loss_of_divine_wards');
    expect(player.statusManager.hasStatus('loss_of_divine_wards' as any)).toBe(true);
    expect(player.elementalResistances['holy' as any]).toBeUndefined();

    // Verify getActiveAfflictions
    const active = EnergyModel.getActiveAfflictions(player.corruptionScore);
    expect(active).toEqual(['tissue_necrosis', 'neural_decay', 'loss_of_divine_wards']);
  });

  it('calculates scaling entropic damage multipliers based on corruption score', () => {
    expect(EnergyModel.calculateEntropicDamageMultiplier(0)).toBe(1.0);
    expect(EnergyModel.calculateEntropicDamageMultiplier(25)).toBe(1.25);
    expect(EnergyModel.calculateEntropicDamageMultiplier(50)).toBe(1.50);
    expect(EnergyModel.calculateEntropicDamageMultiplier(100)).toBe(2.0);
  });
});
