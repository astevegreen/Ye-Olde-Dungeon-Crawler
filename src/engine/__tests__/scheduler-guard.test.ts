import { describe, it, expect, vi } from 'vitest';
import { EnergyScheduler } from '../scheduler';
import { TurnScheduler } from '../core/turnScheduler';
import { Entity } from '../entities/entity';

class MockEntity extends Entity {
  constructor(id: string, speed: number) {
    super({
      id,
      name: `Entity-${id}`,
      type: 'monster',
      faction: 'hostile',
      position: { x: 0, y: 0 },
      stats: { hp: 10, maxHp: 10, attack: 1, defense: 1 },
      speed,
    });
  }
}

describe('Scheduler Zero-Division & Circuit-Breaker Guards', () => {
  it('exports TurnScheduler alias identical to EnergyScheduler', () => {
    expect(TurnScheduler).toBe(EnergyScheduler);
    const ts = new TurnScheduler();
    expect(ts).toBeInstanceOf(EnergyScheduler);
  });

  it('handles entities with 0 or negative speed without crashing or division by zero', () => {
    const scheduler = new EnergyScheduler();
    const frozenMonster = new MockEntity('frozen-1', 0);
    const activeMonster = new MockEntity('active-1', 100);

    scheduler.addEntity(frozenMonster);
    scheduler.addEntity(activeMonster);

    // Advancing should allow active entity to gain energy without NaN or Infinity
    const actor = scheduler.advanceToNextActor();
    expect(actor).toBe(activeMonster);
    expect(Number.isFinite(frozenMonster.energy)).toBe(true);
    expect(Number.isNaN(frozenMonster.energy)).toBe(false);
  });

  it('triggers circuit-breaker safely and yields control if no entities can act within 10,000 ticks', () => {
    const scheduler = new EnergyScheduler();
    // Entity with positive speed that cannot accumulate ready energy
    const stalled = new MockEntity('stalled-1', 10);
    stalled.gainEnergy = () => {}; // Never gains energy

    scheduler.addEntity(stalled);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // advanceToNextActor should not hang or freeze; it should trip the breaker and return null
    const actor = scheduler.advanceToNextActor(100);
    expect(actor).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/circuit.?breaker/i)
    );

    warnSpy.mockRestore();
  });

  it('handles entities with negative speed without throwing or crashing scheduler', () => {
    const scheduler = new EnergyScheduler();
    const e = new MockEntity('e-neg', -50);
    scheduler.addEntity(e);

    expect(() => scheduler.advanceToNextActor(10)).not.toThrow();
  });
});
