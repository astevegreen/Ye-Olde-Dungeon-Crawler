import type { Entity } from './entities/entity';
import { flightRecorder } from './debug/flightRecorder';

export class EnergyScheduler {
  private entities: Entity[];
  private currentTick: number;

  constructor() {
    this.entities = [];
    this.currentTick = 0;
  }

  public get ticks(): number {
    return this.currentTick;
  }

  public addEntity(entity: Entity): void {
    if (!this.entities.includes(entity)) {
      this.entities.push(entity);
    }
  }

  public removeEntity(entity: Entity): void {
    const index = this.entities.findIndex((e) => e.id === entity.id);
    if (index !== -1) {
      this.entities.splice(index, 1);
    }
  }

  public getEntities(): readonly Entity[] {
    return this.entities;
  }

  /**
   * Returns an entity that already has sufficient energy to act (>= 100),
   * without advancing ticks. If multiple entities are ready, prioritizes
   * the player first, then highest energy, then stable ID order.
   */
  public getReadyActor(): Entity | null {
    const readyEntities = this.entities.filter(
      (e) => e.isAlive() && e.canAct()
    );

    if (readyEntities.length === 0) {
      return null;
    }

    readyEntities.sort((a, b) => {
      // 1. Entity with the highest energy acts first
      if (b.energy !== a.energy) {
        return b.energy - a.energy;
      }
      // 2. Tie-breaker: prioritize player
      if (a.type === 'player' && b.type !== 'player') return -1;
      if (b.type === 'player' && a.type !== 'player') return 1;
      // 3. Deterministic ID tie-breaker
      return a.id.localeCompare(b.id);
    });

    return readyEntities[0];
  }

  /**
   * Helper to safely clamp speed in turn cost or division calculations.
   */
  public static clampSpeed(speed: number, minSpeed = 1): number {
    return Math.max(minSpeed, speed);
  }

  /**
   * Advances the world tick-by-tick, distributing energy based on each entity's speed,
   * until at least one living entity has energy >= BASE_ACTION_COST.
   * Returns the next entity eligible to act, or null if no entity can act.
   */
  public advanceToNextActor(maxTicks = 10000): Entity | null {
    // Check if an entity is already ready
    const immediate = this.getReadyActor();
    if (immediate) {
      return immediate;
    }

    // Zero-division / zero-speed guard: only entities with positive effective speed and action capability can gain energy
    const living = this.entities.filter(
      (e) => e.isAlive() && Math.max(0, e.speed) > 0 && (e as any).capabilities?.canAct !== false
    );
    if (living.length === 0) {
      return null;
    }

    let iterations = 0;
    while (iterations < maxTicks) {
      this.currentTick += 1;
      iterations += 1;

      // Distribute energy to all living entities with positive speed
      for (const entity of living) {
        const effSpeed = Math.max(0, entity.speed);
        entity.gainEnergy(effSpeed);
      }

      const ready = this.getReadyActor();
      if (ready) {
        return ready;
      }
    }

    // Circuit breaker: log warning and yield control instead of throwing an unhandled error
    const msg = `Scheduler circuit-breaker triggered: exceeded maxTicks (${maxTicks}) without ready actor.`;
    flightRecorder.warn(msg);
    console.warn(msg);
    return null;
  }

  public reset(): void {
    this.entities = [];
    this.currentTick = 0;
  }
}

export { EnergyScheduler as TurnScheduler };
