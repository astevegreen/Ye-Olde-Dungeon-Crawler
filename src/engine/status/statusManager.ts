import type { StatusType, StatusEffect, SerializedStatusEffect } from './types';
import type { Entity } from '../entities/entity';
import type { GameEngine } from '../engine';
import { StatusHandlerRegistry } from './statusHandlers';
import { goOff } from './endings';

export interface StatusTickResult {
  expired: StatusType[];
  damageTaken: number;
  killed: boolean;
  messages: string[];
}

export class StatusManager {
  private effects: Map<StatusType, StatusEffect> = new Map();

  public hasStatus(type: StatusType): boolean {
    return this.effects.has(type);
  }

  public getStatus(type: StatusType): StatusEffect | undefined {
    return this.effects.get(type);
  }

  public getAll(): readonly StatusEffect[] {
    return Array.from(this.effects.values());
  }

  public getAllActive(): readonly StatusEffect[] {
    return this.getAll();
  }

  /** A blow of `amount` on `entity`, through each status's damage-taken hook (a mark lands it harder). */
  public scaleDamageTaken(entity: Entity, amount: number): number {
    for (const effect of this.effects.values()) {
      const hook = StatusHandlerRegistry.get(effect.type)?.onDamageTaken;
      if (hook) amount = hook(entity, effect, amount);
    }
    return amount;
  }

  /** Whether a status makes its bearer seen through walls (a mark). */
  public revealsBearer(): boolean {
    for (const effect of this.effects.values()) {
      if (StatusHandlerRegistry.get(effect.type)?.sensedThroughWalls) return true;
    }
    return false;
  }

  public applyStatus(
    statusOrType: StatusEffect | StatusType,
    durationOrImmunities?: number | readonly StatusType[],
    potencyOrEntity?: number | Entity,
    engineMaybe?: GameEngine
  ): boolean {
    let status: StatusEffect;
    let immunities: readonly StatusType[] = [];
    let entity: Entity | undefined;
    let engine: GameEngine | undefined;

    if (typeof statusOrType === 'string') {
      status = {
        type: statusOrType,
        duration: typeof durationOrImmunities === 'number' ? durationOrImmunities : 1,
        potency: typeof potencyOrEntity === 'number' ? potencyOrEntity : undefined,
      };
      if (Array.isArray(durationOrImmunities)) {
        immunities = durationOrImmunities;
      }
      if (potencyOrEntity && typeof potencyOrEntity !== 'number') {
        entity = potencyOrEntity;
      }
      engine = engineMaybe;
    } else {
      status = statusOrType;
      immunities = Array.isArray(durationOrImmunities) ? durationOrImmunities : [];
      entity = potencyOrEntity && typeof potencyOrEntity !== 'number' ? potencyOrEntity : undefined;
      engine = engineMaybe;
    }

    return this.applyStatusDetailed(status, immunities, entity, engine).applied;
  }

  /**
   * `applyStatus`, also reporting the line the status's handler logged when it took hold
   * (`StatusHandler.onApply`, which runs only for a new status with both entity and engine
   * given), so a caller with a generic line of its own logs that only when the handler gave none.
   */
  public applyStatusDetailed(
    status: StatusEffect,
    immunities: readonly StatusType[] = [],
    entity?: Entity,
    engine?: GameEngine
  ): { applied: boolean; message?: string } {
    // The list the caller passed, and the entity's own (an Actor's include what it wears).
    if (immunities.includes(status.type) || entity?.isImmuneTo(status.type)) {
      return { applied: false };
    }

    const existing = this.effects.get(status.type);
    if (existing) {
      existing.duration = Math.max(existing.duration, status.duration);
      if (status.potency !== undefined) {
        existing.potency = Math.max(existing.potency ?? 0, status.potency);
      }
      return { applied: true };
    }
    this.effects.set(status.type, { ...status });
    const handler = StatusHandlerRegistry.get(status.type);
    if (handler?.onApply && entity && engine) {
      const message = handler.onApply(entity, status, engine);
      if (message) {
        engine.log(message);
        return { applied: true, message };
      }
    }
    return { applied: true };
  }

  public removeStatus(type: StatusType): boolean {
    return this.effects.delete(type);
  }

  public clear(): void {
    this.effects.clear();
  }

  /**
   * Moves the named statuses this manager holds to `recipient`, as it would take them
   * (its immunities refuse one, a handler's `onApply` runs), with `sourceEntityId` the
   * giver. One the recipient refuses stays here. Returns the statuses moved.
   */
  public transferTo(
    types: readonly StatusType[],
    recipient: Entity,
    giverId: string,
    engine?: GameEngine
  ): StatusType[] {
    const moved: StatusType[] = [];
    for (const type of types) {
      const effect = this.effects.get(type);
      if (!effect) continue;
      const handed: StatusEffect = { ...effect, sourceEntityId: giverId, data: effect.data ? { ...effect.data } : undefined };
      if (recipient.statusManager.applyStatusDetailed(handed, [], recipient, engine).applied) {
        this.effects.delete(type);
        moved.push(type);
      }
    }
    return moved;
  }

  public tick(entity: Entity, engine: GameEngine): StatusTickResult {
    const expired: StatusType[] = [];
    const messages: string[] = [];
    let damageTaken = 0;
    let killed = false;

    for (const [type, effect] of Array.from(this.effects.entries())) {
      const handler = StatusHandlerRegistry.get(type);

      // 1. Process periodic status effects
      if (handler?.onTick) {
        const result = handler.onTick(entity, effect, engine);
        damageTaken += result.damageTaken;
        if (result.message) {
          messages.push(result.message);
        }
        if (result.killed) {
          killed = true;
          // The caller resolves the death without a killer; this names it ("poison").
          entity.pendingDeathCause ??= type.replace(/^[a-z0-9_-]+:/, '').replace(/_/g, ' ');
        }
      }

      // An onTick handler may have removed its own effect already (e.g. an
      // interrupted Rune of Return channel, which fizzles rather than "expiring" —
      // docs/architecture/content-extensibility.md). Don't double-process expiry for an effect that's no
      // longer tracked.
      if (!this.effects.has(type)) continue;

      // 2. Decrement duration
      effect.duration -= 1;
      if (effect.duration <= 0) {
        this.effects.delete(type);
        expired.push(type);

        if (handler?.onExpire) {
          const msg = handler.onExpire(entity, engine);
          if (msg) messages.push(msg);
        } else {
          messages.push(`${entity.name}'s ${type} effect has worn off.`);
        }
        // Run here, not in `onExpire`, which a pack's expire message replaces (`engine.ts`).
        if (handler?.ending?.on.includes('expire')) goOff(engine, entity, effect, handler.ending);
        handler?.onEnd?.(entity, effect, engine);
      }
    }

    for (const msg of messages) {
      engine.log(msg);
    }

    return {
      expired,
      damageTaken,
      killed,
      messages,
    };
  }

  public serialize(): SerializedStatusEffect[] {
    return Array.from(this.effects.values()).map((e) => ({
      type: e.type,
      duration: e.duration,
      potency: e.potency,
      sourceEntityId: e.sourceEntityId,
      data: e.data ? { ...e.data } : undefined,
    }));
  }

  public deserialize(data: SerializedStatusEffect[]): void {
    this.effects.clear();
    if (!Array.isArray(data)) return;
    for (const s of data) {
      if (s && s.type && s.duration > 0) {
        this.effects.set(s.type, {
          type: s.type,
          duration: s.duration,
          potency: s.potency,
          sourceEntityId: s.sourceEntityId,
          data: s.data ? { ...s.data } : undefined,
        });
      }
    }
  }
}
